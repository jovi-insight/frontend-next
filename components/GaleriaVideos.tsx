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

/** Extrai frame de pré-visualização do vídeo Blob. */
function extrairMiniatura(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = url;

      let resolvido = false;
      const finalizar = (resultado: string | null) => {
        if (resolvido) return;
        resolvido = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(resultado);
      };

      const timer = setTimeout(() => {
        finalizar(null);
      }, 4000);

      const capturarFrame = () => {
        try {
          const canvas = document.createElement("canvas");
          const largura = video.videoWidth || 320;
          const altura = video.videoHeight || 180;
          canvas.width = largura;
          canvas.height = altura;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, largura, altura);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            finalizar(dataUrl);
            return;
          }
        } catch {
          // Erro silencioso
        }
        finalizar(null);
      };

      video.onloadeddata = () => {
        try {
          const tempo = Math.min(0.5, video.duration && !isNaN(video.duration) ? video.duration / 2 : 0.1);
          video.currentTime = tempo;
        } catch {
          capturarFrame();
        }
      };

      video.onseeked = () => {
        capturarFrame();
      };

      video.onerror = () => {
        finalizar(null);
      };
    } catch {
      resolve(null);
    }
  });
}

function VideoCard({
  video,
  onAbrir,
  onApagar,
}: {
  video: VideoItem;
  onAbrir: () => void;
  onApagar: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (video.blob) {
      extrairMiniatura(video.blob).then((t) => {
        if (ativo && t) setThumb(t);
      });
    }
    return () => {
      ativo = false;
    };
  }, [video.blob]);

  return (
    <article className="video-library-card">
      <button
        type="button"
        className="video-card-preview"
        onClick={onAbrir}
        aria-label={`Abrir ${video.name}`}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="video-card-thumb" />
        ) : (
          <div className="video-card-thumb-placeholder" />
        )}
        <div className="video-card-play-overlay">
          <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
            play_arrow
          </span>
        </div>
        <span className="video-duration">{formatarDuracao(video.duration)}</span>
      </button>

      <div className="video-card-info">
        <strong className="video-card-name" title={video.name}>
          {video.name}
        </strong>
        <span className="video-card-state">
          {video.transcription
            ? `${video.transcription.segments.length} trechos legendados`
            : "Aguardando transcrição"}
        </span>
      </div>

      <button
        type="button"
        className="video-card-delete"
        onClick={(e) => {
          e.stopPropagation();
          onApagar();
        }}
        title="Remover vídeo"
        aria-label={`Remover ${video.name}`}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
    </article>
  );
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

  const carregar = useCallback(async () => {
    try {
      guardar(await listarVideos());
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [guardar]);

  async function aoEscolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
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
    <section style={{ marginBottom: 36 }}>
      <div className="secao-topo">
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
            <VideoCard
              key={v.id}
              video={v}
              onAbrir={() => router.push(`/player/${v.id}`)}
              onApagar={() => apagar(v)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
