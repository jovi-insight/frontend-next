"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adicionarVideo,
  listarVideos,
  removerVideo,
  type VideoItem,
} from "@/lib/video-library";
import { avisar } from "@/lib/avisos";

/** Duração real do arquivo — o <video> só sabe depois de ler os metadados. */
function lerDuracao(arquivo: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(arquivo);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

function formatarDuracao(segundos: number): string {
  if (!segundos) return "--:--";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Galeria local de vídeos: as aulas gravadas no modo AULA e os arquivos que o
 * aluno adiciona à mão. Fica no IndexedDB do navegador — nada disso sobe para
 * o backend.
 */
export default function GaleriaVideos() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Buscar e gravar separados: assim o efeito só chama setState dentro do
  // .then(), sem a renderização em cascata de um setState síncrono.
  const guardar = useCallback((itens: VideoItem[]) => setVideos(itens), []);

  useEffect(() => {
    let ativo = true;
    listarVideos()
      .then((itens) => ativo && guardar(itens))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [guardar]);

  /** Releitura após adicionar ou remover — ação do usuário, não efeito. */
  const carregar = useCallback(async () => {
    try {
      guardar(await listarVideos());
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [guardar]);

  async function aoEscolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    // Limpa já: escolher o mesmo arquivo de novo precisa disparar change.
    evento.target.value = "";
    if (!arquivo) return;

    setEnviando(true);
    setErro(null);
    try {
      const item = await adicionarVideo(arquivo, await lerDuracao(arquivo));
      router.push(`/player/${item.id}`);
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(item: VideoItem) {
    if (!confirm(`Remover "${item.name}" da galeria deste navegador?`)) return;
    try {
      await removerVideo(item.id);
      await carregar();
      avisar("Vídeo removido da galeria.", "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  return (
    <section style={{ marginBottom: 40 }}>
      <div className="section-header">
        <div className="section-title">
          <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
          <h2>Vídeos e aulas</h2>
        </div>
        <button
          type="button"
          className="chip"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            video_call
          </span>
          {/* Em 390px o rótulo por extenso saía da tela; o ícone basta e o
              aria-label mantém o botão legível para leitor de tela. */}
          <span className="rotulo-largo">{enviando ? "Salvando…" : "Adicionar vídeo"}</span>
          <span className="sr-only">{enviando ? "Salvando vídeo" : "Adicionar vídeo"}</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={aoEscolher}
        style={{ display: "none" }}
      />

      {erro && (
        <p role="alert" style={{ color: "var(--error)", fontSize: 12, marginBottom: 12 }}>
          {erro}
        </p>
      )}

      {videos.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--on-surface-variant)", opacity: 0.7 }}>
          Nenhum vídeo ainda. Grave uma aula no modo AULA da câmera ou adicione um arquivo.
        </p>
      ) : (
        <div className="video-library-grid">
          {videos.map((v) => (
            <article key={v.id} className="video-library-card">
              <button
                type="button"
                className="video-card-preview"
                onClick={() => router.push(`/player/${v.id}`)}
                aria-label={`Abrir ${v.name}`}
              >
                <span className="material-symbols-outlined">play_circle</span>
                <span className="video-duration">{formatarDuracao(v.duration)}</span>
              </button>
              <div className="video-card-info">
                <strong className="video-card-name">{v.name}</strong>
                <span className="video-card-state">
                  {v.transcription
                    ? `${v.transcription.segments.length} trechos legendados`
                    : "Aguardando transcrição"}
                </span>
              </div>
              <button
                type="button"
                className="video-card-delete"
                onClick={() => apagar(v)}
                title="Remover vídeo"
                aria-label={`Remover ${v.name}`}
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
