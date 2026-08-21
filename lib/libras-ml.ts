/**
 * Microserviço de Libras (../libras-service). Porte reduzido de
 * frontend/js/libras-ml-api.js: aqui só a transcrição de mídia, que é o que o
 * player usa. Coleta e treino de landmarks vêm junto com a câmera.
 */

const URL_PADRAO = "http://localhost:8001";
const DEZ_MINUTOS = 10 * 60 * 1000;

/** O serviço pode estar em outra máquina — daí a URL vir do localStorage. */
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
