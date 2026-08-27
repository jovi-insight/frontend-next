import { BASE_URL } from "./api";

/**
 * Módulo de Libras e Transcrição integrado ao backend da JOVI.
 */

const URL_PADRAO = BASE_URL;
const DEZ_MINUTOS = 10 * 60 * 1000;

/** O serviço pode ser customizado via localStorage ou usar a URL padrão do backend. */
export function baseUrlLibras(): string {
  const salva = typeof localStorage !== "undefined" && localStorage.getItem("jovi.libras.ml.url");
  return String(salva || URL_PADRAO).replace(/\/$/, "");
}

function apiKeyLibras(): string {
  return (typeof localStorage !== "undefined" && localStorage.getItem("jovi.libras.ml.apiKey")) || "";
}

export type RespostaTranscricao = {
  language?: string;
  text?: string;
  segments?: { start: number; end: number; text: string }[];
  model?: string;
};

export type PredicaoLibras = {
  letter: string | null;
  candidate?: string;
  unknown: boolean;
  confidence: number;
  probability?: number;
  margin?: number;
  distance?: number;
  radius?: number;
  proximity?: number;
  reason?: string | null;
  source?: string;
  model_version?: string | null;
};

/** POST /v1/media/transcribe — o Gemini transcreve com marcação de tempo. */
export async function transcreverMidia(arquivo: Blob, nome = "midia"): Promise<RespostaTranscricao> {
  if (!(arquivo instanceof Blob)) throw new Error("Selecione um arquivo de áudio ou vídeo.");

  const controle = new AbortController();
  // Vídeo de aula inteira leva minutos; o padrão do fetch cortaria antes.
  const limite = setTimeout(() => controle.abort(), DEZ_MINUTOS);

  const cabecalhos: HeadersInit = {};
  const chave = apiKeyLibras();
  if (chave) cabecalhos["X-API-Key"] = chave;

  const form = new FormData();
  form.append("media", arquivo, nome);

  try {
    const resposta = await fetch(`${baseUrlLibras()}/v1/media/transcribe`, {
      method: "POST",
      headers: cabecalhos,
      body: form,
      signal: controle.signal,
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw new Error(
        typeof corpo.detail === "string"
          ? corpo.detail
          : `Falha na transcrição (HTTP ${resposta.status})`,
      );
    }
    return corpo;
  } catch (erro) {
    if ((erro as Error).name === "AbortError") {
      throw new Error("A transcrição demorou mais de 10 minutos.");
    }
    throw erro;
  } finally {
    clearTimeout(limite);
  }
}

/** POST /v1/predict — inferência neural do alfabeto de Libras */
export async function inferirLandmarks(
  landmarks: { x: number; y: number; z?: number }[],
): Promise<PredicaoLibras> {
  const resposta = await fetch(`${baseUrlLibras()}/v1/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ landmarks }),
  });
  if (!resposta.ok) throw new Error("Falha na inferência neural de Libras");
  return await resposta.json();
}

/** GET /v1/model — status do modelo neural publicado */
export async function statusModelo(): Promise<{
  ready: boolean;
  model_version: string | null;
  classes: string[];
  message?: string;
}> {
  const resposta = await fetch(`${baseUrlLibras()}/v1/model`);
  if (!resposta.ok) throw new Error("Falha ao consultar modelo de Libras");
  return await resposta.json();
}

