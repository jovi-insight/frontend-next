"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import GuardaSessao from "@/components/GuardaSessao";
import TopHeader from "@/components/TopHeader";
import { obterVideo, salvarTranscricao, type VideoItem, type Segmento } from "@/lib/video-library";
import { transcreverMidia } from "@/lib/libras-ml";

function indiceDoSegmento(segmentos: Segmento[], tempo: number): number {
  return segmentos.findIndex((s) => tempo >= s.start && tempo < s.end);
}

function PlayerConteudo({ id }: { id: string }) {
  const [item, setItem] = useState<VideoItem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [urlVideo, setUrlVideo] = useState<string | null>(null);
  const [legendaLigada, setLegendaLigada] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [tempo, setTempo] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let ativo = true;
    let url: string | null = null;

    obterVideo(id)
      .then((v) => {
        if (!ativo) return;
        if (!v) {
          setErro("Vídeo não encontrado na galeria deste navegador.");
          return;
        }
        setItem(v);
        url = URL.createObjectURL(v.blob);
        setUrlVideo(url);
      })
      .catch((e: Error) => ativo && setErro(e.message));

    return () => {
      ativo = false;
      // Sem revoke o blob do vídeo fica preso na memória da aba.
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  const segmentos = useMemo(() => item?.transcription?.segments ?? [], [item]);
  const atual = indiceDoSegmento(segmentos, tempo);
  const legenda = atual >= 0 ? segmentos[atual].text : "";

  const transcrever = useCallback(async () => {
    if (!item) return false;
    setTranscrevendo(true);
    setErro(null);
    try {
      const resultado = await transcreverMidia(item.blob, item.name);
      const salvo = await salvarTranscricao(item.id, resultado);
      setItem(salvo);
      return true;
    } catch (e) {
      setErro(
        `${(e as Error).message} — confira se o microserviço de Libras está no ar (porta 8001).`,
      );
      return false;
    } finally {
      setTranscrevendo(false);
    }
  }, [item]);

  // A transcrição só é pedida quando a legenda é ligada, e uma vez só: o
  // resultado fica salvo no IndexedDB junto com o vídeo.
  async function alternarLegenda() {
    if (legendaLigada) {
      setLegendaLigada(false);
      return;
    }
    if (!item?.transcription && !(await transcrever())) return;
    setLegendaLigada(true);
  }

  if (erro && !item) {
    return (
      <main className="container archive-main">
        <p style={{ color: "var(--error)", fontSize: 13 }}>{erro}</p>
        <Link href="/library" className="focus-link">
          Voltar para a biblioteca
        </Link>
      </main>
    );
  }

  return (
    <>
      <TopHeader titulo="Player" />

      <main className="container archive-main">
        <nav className="breadcrumb">
          <Link href="/library" style={{ textDecoration: "none", color: "inherit" }}>
            Recents
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            chevron_right
          </span>
          <span className="text-primary">{item?.name ?? "Vídeo"}</span>
        </nav>

        {urlVideo && (
          <video
            ref={videoRef}
            src={urlVideo}
            controls
            playsInline
            style={{ width: "100%", borderRadius: 16, background: "#000" }}
            onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)}
          />
        )}

        {legendaLigada && (
          <p className="player-legenda" aria-live="polite">
            {legenda}
          </p>
        )}

        <div className="quiz-controles" style={{ marginTop: 16 }}>
          <button
            type="button"
            className={`video-toggle-btn${legendaLigada ? " ativo" : ""}`}
            onClick={alternarLegenda}
            disabled={transcrevendo}
            aria-pressed={legendaLigada}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              closed_caption
            </span>
            {transcrevendo ? "Transcrevendo…" : legendaLigada ? "Legenda ligada" : "Legenda"}
          </button>
        </div>

        <p style={{ fontSize: 11, color: "var(--on-surface-variant)", marginTop: 12 }}>
          {transcrevendo
            ? "A primeira ativação transcreve o áudio com o Gemini e salva os trechos; nas próximas vezes carrega na hora."
            : segmentos.length
              ? `${segmentos.length} trechos salvos.`
              : "Ative a legenda para transcrever a fala."}
        </p>

        {erro && (
          <p role="alert" style={{ color: "var(--error)", fontSize: 12, marginTop: 12 }}>
            {erro}
          </p>
        )}
      </main>
    </>
  );
}

export default function PlayerPage({ params }: PageProps<"/player/[id]">) {
  const { id } = use(params);
  return (
    <GuardaSessao>
      <PlayerConteudo id={id} />
    </GuardaSessao>
  );
}
