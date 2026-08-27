/**
 * Galeria híbrida de vídeos.
 *
 * O IndexedDB mantém uma cópia para o PWA funcionar offline. Quando há rede,
 * arquivo e metadados são sincronizados com o backend para aparecerem também
 * nos outros aparelhos do aluno.
 */

import {
  atualizarVideoUsuario,
  enviarVideoUsuario,
  isUuid,
  listarVideosUsuario,
  obterVideoUsuario,
  removerVideoUsuario,
  type VideoUsuario,
} from "./api";

const DB_NAME = "jovi-media-library";
const STORE_NAME = "media";
const DB_VERSION = 1;

export type Segmento = { start: number; end: number; text: string };

export type Transcricao = {
  language: string;
  text: string;
  segments: Segmento[];
  model: string | null;
  updatedAt: string;
};

export type VideoItem = {
  id: string;
  name: string;
  type: string;
  size: number;
  duration: number;
  createdAt: string;
  blob?: Blob;
  transcription: Transcricao | null;
  summary?: string | null;
  conteudoId?: string | null;
  remoteId?: string | null;
  remoteUrl?: string | null;
  syncStatus?: "sincronizando" | "sincronizado" | "pendente";
  syncError?: string | null;
};

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador não oferece armazenamento de vídeos."));
      return;
    }
    const pedido = indexedDB.open(DB_NAME, DB_VERSION);
    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      if (!banco.objectStoreNames.contains(STORE_NAME)) {
        const store = banco.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error ?? new Error("Falha ao abrir a galeria."));
  });
}

async function transacao<T>(
  modo: IDBTransactionMode,
  operacao: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const banco = await abrirBanco();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = banco.transaction(STORE_NAME, modo);
      const store = tx.objectStore(STORE_NAME);
      let pedido: IDBRequest<T>;
      try {
        pedido = operacao(store);
      } catch (erro) {
        reject(erro);
        return;
      }
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error ?? new Error("Falha na galeria de vídeos."));
      tx.onabort = () => reject(tx.error ?? new Error("Operação cancelada na galeria."));
    });
  } finally {
    banco.close();
  }
}

function criarId(): string {
  return `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function comoArquivo(item: VideoItem): File | null {
  if (!item.blob) return null;
  if (item.blob instanceof File) return item.blob;
  return new File([item.blob], item.name || "video.webm", {
    type: item.type || item.blob.type || "video/webm",
  });
}

function lerTranscricao(valor: unknown): Transcricao | null {
  if (!valor || typeof valor !== "object") return null;
  const dados = valor as Record<string, unknown>;
  const segmentos = Array.isArray(dados.segments)
    ? dados.segments
        .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === "object"))
        .map((s) => ({
          start: Number(s.start) || 0,
          end: Number(s.end) || 0,
          text: String(s.text || ""),
        }))
    : [];
  return {
    language: String(dados.language || "pt-BR"),
    text: String(dados.text || ""),
    segments: segmentos,
    model: dados.model == null ? null : String(dados.model),
    updatedAt: String(dados.updatedAt || new Date().toISOString()),
  };
}

function remotoParaItem(video: VideoUsuario, existente?: VideoItem): VideoItem {
  return {
    id: existente?.id || video.id,
    name: video.nome,
    type: video.mime_type,
    size: video.tamanho,
    duration: video.duracao,
    createdAt: video.criado_em,
    blob: existente?.blob,
    transcription: lerTranscricao(video.transcricao) || existente?.transcription || null,
    summary: video.resumo ?? existente?.summary ?? null,
    conteudoId: existente?.conteudoId ?? null,
    remoteId: video.id,
    remoteUrl: video.url_storage,
    syncStatus: "sincronizado",
    syncError: null,
  };
}

async function salvarItem(item: VideoItem): Promise<VideoItem> {
  await transacao<IDBValidKey>("readwrite", (store) => store.put(item));
  return item;
}

export async function adicionarVideo(arquivo: File, duracao = 0): Promise<VideoItem> {
  if (!(arquivo instanceof Blob) || !String(arquivo.type || "").startsWith("video/")) {
    throw new Error("A galeria aceita somente arquivos de vídeo.");
  }
  const item: VideoItem = {
    id: criarId(),
    name: arquivo.name || "Vídeo sem título",
    type: arquivo.type || "video/mp4",
    size: arquivo.size,
    duration: Number(duracao) || 0,
    createdAt: new Date().toISOString(),
    blob: arquivo,
    transcription: null,
    syncStatus: "sincronizando",
    syncError: null,
  };
  await transacao("readwrite", (store) => store.add(item));
  return sincronizarVideo(item.id);
}

export async function obterVideo(id: string): Promise<VideoItem | undefined> {
  const local = await transacao<VideoItem | undefined>("readonly", (store) => store.get(id));
  if (local) return local;
  if (!isUuid(id)) return undefined;
  try {
    const remoto = remotoParaItem(await obterVideoUsuario(id));
    await salvarItem(remoto);
    return remoto;
  } catch {
    return undefined;
  }
}

export async function listarVideos(): Promise<VideoItem[]> {
  let itens = await transacao<VideoItem[]>("readonly", (store) => store.getAll());
  try {
    const remotos = await listarVideosUsuario();
    for (const remoto of remotos) {
      const existente = itens.find((item) => item.remoteId === remoto.id || item.id === remoto.id);
      const combinado = remotoParaItem(remoto, existente);
      await salvarItem(combinado);
      if (existente) itens = itens.map((item) => (item.id === existente.id ? combinado : item));
      else itens.push(combinado);
    }
  } catch {
    // Offline: a cópia do IndexedDB continua utilizável normalmente.
  }
  return itens.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function sincronizarVideo(id: string): Promise<VideoItem> {
  const item = await transacao<VideoItem | undefined>("readonly", (store) => store.get(id));
  if (!item) throw new Error("Vídeo não encontrado na galeria.");

  item.syncStatus = "sincronizando";
  item.syncError = null;
  await salvarItem(item);

  try {
    if (!item.remoteId) {
      const arquivo = comoArquivo(item);
      if (!arquivo) throw new Error("A cópia offline do vídeo não está disponível.");
      const remoto = await enviarVideoUsuario(arquivo, item.duration);
      item.remoteId = remoto.id;
      item.remoteUrl = remoto.url_storage;
    }
    if (item.transcription || item.summary != null) {
      const remoteId = item.remoteId;
      if (!remoteId) throw new Error("O vídeo ainda não recebeu um ID do banco.");
      const atualizado = await atualizarVideoUsuario(remoteId, {
        transcricao: item.transcription as unknown as Record<string, unknown> | null,
        resumo: item.summary ?? null,
      });
      item.remoteUrl = atualizado.url_storage;
    }
    item.syncStatus = "sincronizado";
    item.syncError = null;
  } catch (erro) {
    item.syncStatus = "pendente";
    item.syncError = (erro as Error).message;
  }
  await salvarItem(item);
  return item;
}

export async function sincronizarVideosPendentes(): Promise<void> {
  const itens = await transacao<VideoItem[]>("readonly", (store) => store.getAll());
  const pendentes = itens.filter(
    (item) => item.syncStatus === "pendente" || (!item.remoteId && Boolean(item.blob)),
  );
  for (const item of pendentes) await sincronizarVideo(item.id);
}

export async function salvarTranscricao(
  id: string,
  transcricao: Partial<Transcricao>,
): Promise<VideoItem> {
  const item = await obterVideo(id);
  if (!item) throw new Error("Vídeo não encontrado na galeria.");
  item.transcription = {
    language: transcricao.language || "pt-BR",
    text: transcricao.text || "",
    segments: Array.isArray(transcricao.segments) ? transcricao.segments : [],
    model: transcricao.model ?? null,
    updatedAt: new Date().toISOString(),
  };
  await salvarItem(item);
  return sincronizarVideo(item.id);
}

export async function salvarResumoVideo(
  id: string,
  summary: string,
): Promise<VideoItem> {
  const item = await obterVideo(id);
  if (!item) throw new Error("Vídeo não encontrado na galeria.");
  item.summary = summary;
  await salvarItem(item);
  return sincronizarVideo(item.id);
}

export async function removerVideo(id: string): Promise<undefined> {
  const item = await transacao<VideoItem | undefined>("readonly", (store) => store.get(id));
  const remoteId = item?.remoteId || (isUuid(id) ? id : null);
  if (remoteId) await removerVideoUsuario(remoteId);
  return transacao("readwrite", (store) => store.delete(id));
}
