"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import GuardaSessao from "@/components/GuardaSessao";
import { getConteudo, narrar } from "@/lib/api";
import { contarPalavras, dividirEmBlocos, type Bloco } from "@/lib/focus-blocks";

const BLOCOS_ATE_PAUSA = 5;
const SEGUNDOS_DE_PAUSA = 30;

type Fase = "carregando" | "erro" | "intro" | "lendo" | "pausa" | "fim";

function FocusConteudo({ id }: { id: string }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("carregando");
  const [indice, setIndice] = useState(0);
  const [contagem, setContagem] = useState(SEGUNDOS_DE_PAUSA);

  useEffect(() => {
    let ativo = true;
    getConteudo(id)
      .then((doc) => {
        if (!ativo) return;
        // O Modo Foco lê o resumo, não o despejo bruto da OCR: é ele que está
        // em frases limpas. Sem resumo, o texto extraído ainda serve.
        setTexto(doc.resumo_ia || doc.extracao_original || "");
        setFase("intro");
      })
      .catch((e: Error) => {
        if (!ativo) return;
        setErro(e.message);
        setFase("erro");
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  const blocos = useMemo<Bloco[]>(() => dividirEmBlocos(texto), [texto]);
  const totalPalavras = useMemo(
    () => blocos.reduce((soma, b) => soma + b.frases.reduce((n, f) => n + contarPalavras(f), 0), 0),
    [blocos],
  );

  // Contagem regressiva da pausa. O relógio é o sistema externo aqui, então o
  // efeito só o liga e desliga — o setState mora no callback dele, e o reset
  // do contador acontece em irPara(), junto com a entrada na pausa.
  useEffect(() => {
    if (fase !== "pausa") return;
    const timer = setInterval(() => {
      setContagem((s) => {
        if (s <= 1) {
          setFase("lendo");
          return SEGUNDOS_DE_PAUSA;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fase]);

  const irPara = useCallback(
    (novo: number, avancando: boolean) => {
      if (novo < 0) return;
      if (novo >= blocos.length) {
        setFase("fim");
        return;
      }
      setIndice(novo);
      // Só pausa ao avançar, ao cruzar um múltiplo de BLOCOS_ATE_PAUSA.
      if (avancando && novo % BLOCOS_ATE_PAUSA === 0 && novo > 0) {
        setContagem(SEGUNDOS_DE_PAUSA);
        setFase("pausa");
      }
    },
    [blocos.length],
  );

  // Setas do teclado percorrem os blocos, como no vanilla.
  useEffect(() => {
    if (fase !== "lendo") return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") irPara(indice + 1, true);
      if (e.key === "ArrowLeft") irPara(indice - 1, false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [fase, indice, irPara]);

  if (fase === "carregando") {
    return (
      <main className="focus-main">
        <div className="spinner" />
      </main>
    );
  }

  if (fase === "erro" || blocos.length === 0) {
    return (
      <main className="focus-main">
        <section className="focus-erro">
          <p>{erro ?? "Este documento não tem texto para ler."}</p>
          <Link className="focus-link" href="/library">
            Voltar para a biblioteca
          </Link>
        </section>
      </main>
    );
  }

  const progresso = Math.round(((indice + 1) / blocos.length) * 100);
  const bloco = blocos[indice];
  const ultimo = indice === blocos.length - 1;

  return (
    <>
      <header className="focus-header">
        <Link href={`/summary/${id}?voltando=1`} className="focus-sair" aria-label="Sair do Modo Foco">
          <span className="material-symbols-outlined">close</span>
        </Link>
        <div
          className="focus-progresso"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progresso}
          aria-label="Progresso da leitura"
        >
          <div className="focus-progresso-barra" style={{ width: `${progresso}%` }} />
        </div>
        <span className="focus-contador" aria-live="polite">
          {fase === "lendo" ? `${indice + 1}/${blocos.length}` : "—"}
        </span>
      </header>

      <main className="focus-main">
        {fase === "intro" && (
          <section className="focus-intro">
            <h1 className="focus-intro-titulo">Modo Foco</h1>
            <p className="focus-intro-metrica">
              {blocos.length} partes · {totalPalavras} palavras
            </p>
            <p className="focus-intro-explicacao">
              Vamos ler em partes curtas, uma de cada vez. Você pode pausar quando quiser.
            </p>
            <button className="primary-btn" onClick={() => setFase("lendo")}>
              Começar
            </button>
          </section>
        )}

        {fase === "lendo" && (
          <section className="focus-cartao" aria-live="polite">
            {bloco.titulo && <h2 className="focus-cartao-titulo">{bloco.titulo}</h2>}
            <div className="focus-cartao-texto">
              {bloco.frases.map((frase, i) => (
                <p className="focus-frase" key={i}>
                  {frase}
                </p>
              ))}
            </div>
          </section>
        )}

        {fase === "pausa" && (
          <section className="focus-pausa" aria-live="polite">
            <h2 className="focus-pausa-titulo">Hora de uma pausa</h2>
            <p className="focus-pausa-texto">
              Levante os olhos da tela, alongue os ombros, beba água. Volto em{" "}
              <span aria-live="off">{contagem}</span>s.
            </p>
            <button className="focus-link" onClick={() => setFase("lendo")}>
              Pular a pausa
            </button>
          </section>
        )}

        {fase === "fim" && (
          <section className="focus-intro">
            <h1 className="focus-intro-titulo">Leitura concluída</h1>
            <p className="focus-intro-metrica">
              {blocos.length} partes · {totalPalavras} palavras
            </p>
            <Link className="primary-btn" href={`/summary/${id}?voltando=1`} style={{ textDecoration: "none" }}>
              Voltar ao resumo
            </Link>
          </section>
        )}
      </main>

      {fase === "lendo" && (
        <nav className="focus-controles" aria-label="Navegação da leitura">
          <button
            className="focus-btn"
            aria-label="Bloco anterior"
            disabled={indice === 0}
            onClick={() => irPara(indice - 1, false)}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

          <BotaoNarrarBloco bloco={bloco} />

          <button
            className="focus-btn focus-btn-principal"
            onClick={() => irPara(indice + 1, true)}
          >
            <span>{ultimo ? "Concluir" : "Próximo"}</span>
          </button>
        </nav>
      )}
    </>
  );
}

/** Narra o bloco: MP3 do backend primeiro, voz do navegador como reserva. */
function BotaoNarrarBloco({ bloco }: { bloco: Bloco }) {
  const [estado, setEstado] = useState<"parado" | "carregando" | "falando">("parado");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const parar = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setEstado("parado");
  }, []);

  // Trocar de bloco não pode deixar a narração do anterior tocando.
  useEffect(() => parar, [bloco, parar]);

  async function alternar() {
    if (estado !== "parado") return parar();
    const texto = bloco.frases.join(" ");
    setEstado("carregando");

    try {
      const blob = await narrar(texto, "pt");
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = parar;
      audio.onerror = parar;
      await audio.play();
      audioRef.current = audio;
      setEstado("falando");
      return;
    } catch (e) {
      console.warn("Narração do backend indisponível, usando a voz do navegador:", e);
    }

    if (typeof speechSynthesis === "undefined" || speechSynthesis.getVoices().length === 0) {
      setEstado("parado");
      return;
    }
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    fala.rate = 0.95;
    fala.onend = parar;
    fala.onerror = parar;
    speechSynthesis.resume();
    speechSynthesis.speak(fala);
    setEstado("falando");
  }

  return (
    <button
      className="focus-btn"
      aria-label="Ouvir este bloco"
      aria-pressed={estado !== "parado"}
      onClick={alternar}
    >
      <span
        className={`material-symbols-outlined${estado === "carregando" ? " girando" : ""}`}
      >
        {estado === "falando" ? "stop" : estado === "carregando" ? "progress_activity" : "volume_up"}
      </span>
    </button>
  );
}

export default function FocusPage({ params }: PageProps<"/focus/[id]">) {
  const { id } = use(params);
  return (
    <GuardaSessao>
      <div className="focus-body">
        <FocusConteudo id={id} />
      </div>
    </GuardaSessao>
  );
}
