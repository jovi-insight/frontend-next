/**
 * Galeria local de vídeos. Porte de frontend/js/video-library.js.
 * IndexedDB porque localStorage não guarda arquivos grandes.
 */

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
  blob: Blob;
  transcription: Transcricao | null;
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
  };
  await transacao("readwrite", (store) => store.add(item));
  return item;
}

export function obterVideo(id: string): Promise<VideoItem | undefined> {
  return transacao("readonly", (store) => store.get(id));
}

export async function listarVideos(): Promise<VideoItem[]> {
  const itens = await transacao<VideoItem[]>("readonly", (store) => store.getAll());
  return itens.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
  await transacao("readwrite", (store) => store.put(item));
  return item;
}

export function removerVideo(id: string): Promise<undefined> {
  return transacao("readwrite", (store) => store.delete(id));
}
