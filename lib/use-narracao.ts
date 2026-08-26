"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { narrar } from "./api";

export type EstadoNarracao = "parado" | "carregando" | "falando" | "pausado";

/**
 * Narra um texto. O MP3 do ElevenLabs (POST /ia/narrar) vem primeiro porque
 * toca em qualquer navegador; a voz do sistema não é garantida (no Linux
 * depende do speech-dispatcher e, sem ele, speak() é aceito e não sai som
 * nenhum, sem erro).
 *
 * `obterTexto` é assíncrono porque quem narra em outro idioma precisa traduzir
 * antes — o ElevenLabs lê o texto como ele está.
 */
export function useNarracao(obterTexto: () => string | Promise<string>) {
  const [estado, setEstado] = useState<EstadoNarracao>("parado");
  // Só o MP3 tem duração real; na voz do navegador o progresso fica em zero e
  // a tela mostra apenas "Narrando…".
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Analisador da Web Audio: é o que faz as barras subirem e descerem no
  // ritmo real da fala, em vez de uma animação decorativa.
  const [analisador, setAnalisador] = useState<AnalyserNode | null>(null);
  const contextoRef = useRef<AudioContext | null>(null);
  // Reouvir o mesmo texto não gasta uma segunda chamada de IA.
  const cacheRef = useRef<Map<string, string>>(new Map());
  const textoRef = useRef(obterTexto);
  // Atualizar em efeito, e não no corpo do render: o hook precisa da versão
  // mais recente do getter sem que `alternar` mude de identidade a cada tecla
  // digitada na página que o usa.
  useEffect(() => {
    textoRef.current = obterTexto;
  });

  const parar = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setProgresso({ atual: 0, total: 0 });
    setAnalisador(null);
    setEstado("parado");
  }, []);

  // Sair da página no meio da narração não pode deixar a voz tocando, e os
  // object URLs dos MP3s precisam ser liberados.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      audioRef.current?.pause();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
      void contextoRef.current?.close();
    };
  }, []);

  const falarComNavegador = useCallback(
    (texto: string, idioma: string): boolean => {
      if (typeof speechSynthesis === "undefined") return false;
      if (speechSynthesis.getVoices().length === 0) return false;

      const fala = new SpeechSynthesisUtterance(texto);
      fala.lang = BCP47[idioma] || "pt-BR";
      fala.rate = 0.95;
      // Só lang não basta: em várias combinações de Chrome + Linux a fala sai
      // muda se a voz não vier escolhida explicitamente.
      const voz = speechSynthesis
        .getVoices()
        .find((v) => v.lang?.toLowerCase().startsWith(idioma));
      if (voz) fala.voice = voz;
      fala.onend = parar;
      fala.onerror = parar;
      // O Chrome deixa a fila em pausa depois de ocioso e o speak() seguinte
      // entra nela sem nunca tocar.
      speechSynthesis.resume();
      speechSynthesis.speak(fala);
      setEstado("falando");
      return true;
    },
    [parar],
  );

  /** Pausa sem perder o ponto da fala; `alternar` retoma dali. */
  const pausar = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setEstado("pausado");
      return;
    }
    // Voz do navegador: o Chrome só pausa se a fala já começou de fato.
    if (typeof speechSynthesis !== "undefined" && speechSynthesis.speaking) {
      speechSynthesis.pause();
      setEstado("pausado");
    }
  }, []);

  const retomar = useCallback(() => {
    if (audioRef.current) {
      void audioRef.current.play();
      setEstado("falando");
      return;
    }
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.resume();
      setEstado("falando");
    }
  }, []);

  /**
   * Liga o <audio> num AnalyserNode. Um elemento só pode virar fonte uma vez,
   * e a partir daí o som passa a sair pelo contexto — daí o connect no
   * destination, sem o qual a narração ficaria muda.
   */
  const ligarAnalisador = useCallback((audio: HTMLAudioElement) => {
    try {
      const Contexto =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Contexto) return;
      const ctx = (contextoRef.current ??= new Contexto());
      void ctx.resume();
      const fonte = ctx.createMediaElementSource(audio);
      const nó = ctx.createAnalyser();
      nó.fftSize = 128;
      nó.smoothingTimeConstant = 0.75;
      fonte.connect(nó);
      nó.connect(ctx.destination);
      setAnalisador(nó);
    } catch (e) {
      // Sem Web Audio a narração continua tocando; só não há barras.
      console.warn("Visualizador de voz indisponível:", e);
    }
  }, []);

  const alternar = useCallback(
    async (idioma = "pt") => {
      // Tocando → pausa; pausado → retoma. Parar de vez é o botão dedicado,
      // senão reouvir custaria outra geração de voz.
      if (estado === "falando") return pausar();
      if (estado === "pausado") return retomar();
      if (estado === "carregando") return parar();

      setEstado("carregando");
      let texto = "";
      try {
        texto = (await textoRef.current()).trim();
        if (!texto) return setEstado("parado");

        const chave = `${idioma}|${texto}`;
        let url = cacheRef.current.get(chave);
        if (!url) {
          const blob = await narrar(texto, idioma);
          url = URL.createObjectURL(blob);
          cacheRef.current.set(chave, url);
        }
        const audio = new Audio(url);
        ligarAnalisador(audio);
        audio.onended = parar;
        audio.onerror = parar;
        audio.ontimeupdate = () =>
          setProgresso({ atual: audio.currentTime, total: audio.duration || 0 });
        await audio.play();
        audioRef.current = audio;
        setEstado("falando");
        return;
      } catch (e) {
        console.warn("Narração do backend indisponível, usando a voz do navegador:", e);
      }

      if (!texto || !falarComNavegador(texto, idioma)) setEstado("parado");
    },
    [estado, parar, pausar, retomar, falarComNavegador, ligarAnalisador],
  );

  return { estado, alternar, parar, pausar, retomar, progresso, analisador };
}

const BCP47: Record<string, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
};
