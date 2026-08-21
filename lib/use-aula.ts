"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  criarProcessadorDeBlocos,
  ehDuplicata,
  extensaoPara,
  melhorTipoAudio,
  type Processador,
} from "./blocos-transcricao";
import { transcreverMidia } from "./libras-ml";

// A API tem prefixo no Chrome e não existe nos tipos padrão do DOM.
type Reconhecedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string }; length: number }[] & { length: number };
};

function criarReconhecedor(): Reconhecedor | null {
  const janela = window as unknown as {
    SpeechRecognition?: new () => Reconhecedor;
    webkitSpeechRecognition?: new () => Reconhecedor;
  };
  const Classe = janela.SpeechRecognition ?? janela.webkitSpeechRecognition;
  return Classe ? new Classe() : null;
}

export type Fala = { texto: string; segundo: number };
export type Motor = "navegador" | "backend";

/** Blocos de 8s: curto demais corta a frase, longo demais atrasa a legenda. */
const BLOCO_MS = 8000;
/** Dois erros de rede seguidos, sem nenhum resultado no meio, e trocamos. */
const ERROS_ATE_TROCAR = 2;
/** Sem nenhum resultado nesse tempo, o motor do navegador está mudo. */
const SILENCIO_ATE_TROCAR = 8000;

/**
 * Modo Aula: transcreve a fala do professor ao vivo.
 *
 * Começa pelo reconhecimento nativo do navegador — instantâneo e sem custo.
 * Em Firefox e Safari ele não existe, e em Chromium de distro Linux ele
 * costuma existir mas não capturar nada (erro `network`/`service-not-allowed`,
 * sem exceção síncrona). Como isso não dá para detectar só checando a API, a
 * troca para o backend também acontece **no meio da sessão**: o texto já
 * capturado e o tempo decorrido continuam os mesmos, só o motor muda.
 */
export function useAula() {
  const [gravando, setGravando] = useState(false);
  const [falas, setFalas] = useState<Fala[]>([]);
  const [parcial, setParcial] = useState("");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [motor, setMotor] = useState<Motor>("navegador");
  const [aviso, setAviso] = useState<string | null>(null);

  const reconhecedorRef = useRef<Reconhecedor | null>(null);
  const inicioRef = useRef(0);
  const querendoRef = useRef(false);
  const falasRef = useRef<Fala[]>([]);

  // Estado do motor de backend.
  const streamRef = useRef<MediaStream | null>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const processadorRef = useRef<Processador | null>(null);

  // Detecção de motor mudo.
  const errosRef = useRef(0);
  const relogioSilencioRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trocouRef = useRef(false);

  const segundosAgora = () => Math.max(0, Math.round((Date.now() - inicioRef.current) / 1000));

  /** Guarda a fala, ignorando reentrega da API. */
  const registrarFala = useCallback((texto: string) => {
    const limpo = texto.trim();
    if (!limpo) return;
    const segundo = Math.max(0, Math.round((Date.now() - inicioRef.current) / 1000));
    if (ehDuplicata(falasRef.current.at(-1), limpo, segundo)) return;
    falasRef.current = [...falasRef.current, { texto: limpo, segundo }];
    setFalas(falasRef.current);
  }, []);

  // Cronômetro da aula.
  useEffect(() => {
    if (!gravando) return;
    const timer = setInterval(() => setSegundos(segundosAgora()), 1000);
    return () => clearInterval(timer);
  }, [gravando]);

  const limparRelogioSilencio = () => {
    if (relogioSilencioRef.current) clearTimeout(relogioSilencioRef.current);
    relogioSilencioRef.current = null;
  };

  const desligarNavegador = useCallback(() => {
    limparRelogioSilencio();
    const r = reconhecedorRef.current;
    if (!r) return;
    r.onend = null;
    r.onerror = null;
    r.onresult = null;
    try {
      r.stop();
    } catch {
      /* já parado */
    }
    reconhecedorRef.current = null;
  }, []);

  const desligarBackend = useCallback(() => {
    processadorRef.current?.destruir();
    processadorRef.current = null;
    const g = gravadorRef.current;
    gravadorRef.current = null;
    if (g && g.state !== "inactive") {
      try {
        g.stop();
      } catch {
        /* já parado */
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /** Motor de reserva: blocos de 8s para POST /v1/media/transcribe. */
  const iniciarBackend = useCallback(async (): Promise<boolean> => {
    if (typeof MediaRecorder !== "function" || !navigator.mediaDevices?.getUserMedia) return false;
    const tipo = melhorTipoAudio();
    if (!tipo) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!querendoRef.current) {
        // A permissão pode demorar mais que a própria aula: se ela já foi
        // encerrada nesse meio-tempo, o microfone não pode ficar aberto.
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      streamRef.current = stream;

      const processador = criarProcessadorDeBlocos({
        transcrever: async (blob) => {
          const r = await transcreverMidia(blob, `bloco.${extensaoPara(tipo)}`);
          return (r.text ?? "").trim();
        },
        aoEntregar: (texto) => registrarFala(texto),
        aoFalhar: (e) => console.warn("Bloco de áudio falhou:", e),
        limiteConcorrencia: 1,
      });
      processadorRef.current = processador;

      const gravador = new MediaRecorder(stream, { mimeType: tipo });
      gravador.ondataavailable = (e) => {
        if (e.data?.size) processador.adicionar(e.data);
      };
      gravador.start(BLOCO_MS);
      gravadorRef.current = gravador;
      setMotor("backend");
      return true;
    } catch (e) {
      console.warn("Motor de backend indisponível:", e);
      return false;
    }
  }, [registrarFala]);

  /** Troca de motor sem perder o que já foi transcrito. */
  const trocarParaBackend = useCallback(
    async (razao: string) => {
      if (trocouRef.current || !querendoRef.current) return;
      trocouRef.current = true;
      desligarNavegador();
      setParcial("");
      const ok = await iniciarBackend();
      setAviso(
        ok
          ? `A transcrição passou a usar o servidor (${razao}). A legenda demora alguns segundos a mais.`
          : "Não foi possível transcrever nem pelo navegador nem pelo servidor.",
      );
      if (!ok) setErro("Transcrição indisponível neste dispositivo.");
    },
    [desligarNavegador, iniciarBackend],
  );

  const armarRelogioSilencio = useCallback(() => {
    limparRelogioSilencio();
    relogioSilencioRef.current = setTimeout(
      () => trocarParaBackend("o navegador ficou mudo"),
      SILENCIO_ATE_TROCAR,
    );
  }, [trocarParaBackend]);

  const iniciarNavegador = useCallback((): boolean => {
    const r = criarReconhecedor();
    if (!r) return false;

    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (evento) => {
      // Qualquer resultado prova que o motor funciona: zera o contador de
      // erro e desarma o relógio de silêncio.
      errosRef.current = 0;
      limparRelogioSilencio();

      let emAndamento = "";
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const trecho = evento.results[i][0].transcript;
        if (evento.results[i].isFinal) registrarFala(trecho);
        else emAndamento += trecho;
      }
      setParcial(emAndamento.trim());
    };

    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // silêncio é normal
      if (e.error === "network" || e.error === "service-not-allowed") {
        errosRef.current += 1;
        if (errosRef.current >= ERROS_ATE_TROCAR) {
          void trocarParaBackend("o reconhecimento do navegador falhou");
        }
        return;
      }
      setErro(`Reconhecimento falhou (${e.error}).`);
    };

    // O Chrome encerra sozinho após silêncio e tem limite de sessão; sem o
    // reinício a legenda morre no meio da aula.
    r.onend = () => {
      if (!querendoRef.current || reconhecedorRef.current !== r) return;
      try {
        r.start();
      } catch {
        /* já reiniciado */
      }
    };

    reconhecedorRef.current = r;
    try {
      r.start();
      setMotor("navegador");
      armarRelogioSilencio();
      return true;
    } catch {
      reconhecedorRef.current = null;
      return false;
    }
  }, [armarRelogioSilencio, registrarFala, trocarParaBackend]);

  const iniciar = useCallback(async () => {
    querendoRef.current = true;
    trocouRef.current = false;
    errosRef.current = 0;
    inicioRef.current = Date.now();
    falasRef.current = [];
    setFalas([]);
    setParcial("");
    setSegundos(0);
    setErro(null);
    setAviso(null);
    setGravando(true);

    // Sem a API do navegador, vai direto ao backend — é o caso de Firefox e
    // Safari, onde nem existe o que tentar.
    if (iniciarNavegador()) return;

    trocouRef.current = true;
    const ok = await iniciarBackend();
    if (ok) {
      setAviso("Este navegador não transcreve sozinho; a aula usa o servidor.");
    } else {
      setErro("Este navegador não tem reconhecimento de fala e o servidor não respondeu.");
      setGravando(false);
      querendoRef.current = false;
    }
  }, [iniciarBackend, iniciarNavegador]);

  const encerrar = useCallback(() => {
    querendoRef.current = false;
    desligarNavegador();
    desligarBackend();
    setGravando(false);
    setParcial("");
  }, [desligarBackend, desligarNavegador]);

  // Sair da tela com a aula rodando não pode deixar o microfone aberto.
  useEffect(
    () => () => {
      querendoRef.current = false;
      desligarNavegador();
      desligarBackend();
    },
    [desligarBackend, desligarNavegador],
  );

  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");

  return {
    gravando,
    falas,
    parcial,
    erro,
    aviso,
    motor,
    segundos,
    tempoFormatado: `${mm}:${ss}`,
    ultimaFala: falas.at(-1)?.texto ?? "",
    textoCompleto: falas.map((f) => f.texto).join(" "),
    iniciar,
    encerrar,
  };
}
