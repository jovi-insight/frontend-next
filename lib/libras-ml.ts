import { BASE_URL } from "./api";

/**
 * Módulo de Libras e Transcrição integrado ao backend da JOVI.
 */

const URL_PADRAO = BASE_URL;
const DEZ_MINUTOS = 10 * 60 * 1000;
const LIMITE_CONSULTA = 30 * 1000;

/** O treinamento usa sempre o mesmo backend integrado ao INSIGHT. */
export function baseUrlLibras(): string {
  return URL_PADRAO.replace(/\/$/, "");
}

function apiKeyLibras(): string {
  return (typeof localStorage !== "undefined" && localStorage.getItem("jovi.libras.ml.apiKey")) || "";
}

async function aguardarNovaTentativa(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Consultas de status podem coincidir com a inicialização do backend. Repetir
 * uma vez evita exibir o erro cru "Failed to fetch" por uma falha transitória.
 */
async function consultarTreinamento<T>(rota: string, mensagemHttp: string): Promise<T> {
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), LIMITE_CONSULTA);

    try {
      const resposta = await fetch(`${baseUrlLibras()}${rota}`, {
        cache: "no-store",
        signal: controle.signal,
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        const detalhe = typeof corpo.detail === "string" ? corpo.detail : null;
        const erroHttp = new Error(detalhe || `${mensagemHttp} (HTTP ${resposta.status})`);
        erroHttp.name = "RespostaHttpError";
        throw erroHttp;
      }
      return await resposta.json();
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa === 0) await aguardarNovaTentativa(700);
    } finally {
      clearTimeout(limite);
    }
  }

  if ((ultimoErro as Error | undefined)?.name === "AbortError") {
    throw new Error("O backend do INSIGHT demorou para responder. Tente novamente.");
  }
  if (ultimoErro instanceof Error && ultimoErro.name === "RespostaHttpError") {
    throw ultimoErro;
  }
  throw new Error("Não foi possível conectar ao backend do INSIGHT. Verifique sua conexão e tente novamente.");
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
  trained_at?: string;
  metrics?: {
    validation_accuracy?: number;
    validation_loss?: number;
    best_epoch?: number;
    training_samples?: number;
  };
  message?: string;
}> {
  return consultarTreinamento("/v1/model", "Falha ao consultar modelo de Libras");
}

export type ResumoDataset = {
  total_samples: number;
  users: number;
  sessions: number;
  per_letter: Record<string, number>;
};

/** GET /v1/dataset — resumo do dataset de amostras coletadas */
export async function obterResumoDataset(): Promise<ResumoDataset> {
  return consultarTreinamento("/v1/dataset", "Falha ao consultar dataset de Libras");
}

/** POST /v1/samples/batch — salva amostras de landmarks para uma letra */
export async function enviarAmostrasLetra(
  letra: string,
  amostrasLandmarks: { x: number; y: number; z?: number }[][],
  userId = "web-user",
  sessionId = `sessao-${Date.now()}`,
): Promise<{ accepted: number; duplicates: number; total: number; dataset: ResumoDataset }> {
  const samples = amostrasLandmarks.map((landmarks, index) => ({
    sample_id: `${sessionId}-${index}`,
    user_id: userId,
    session_id: sessionId,
    letter: letra.toUpperCase(),
    landmarks: landmarks.map((p) => ({
      x: Number(p.x),
      y: Number(p.y),
      z: typeof p.z === "number" && Number.isFinite(p.z) ? Number(p.z) : 0,
    })),
  }));

  const cabecalhos: HeadersInit = { "Content-Type": "application/json" };
  const chave = apiKeyLibras();
  if (chave) cabecalhos["X-API-Key"] = chave;

  const resposta = await fetch(`${baseUrlLibras()}/v1/samples/batch`, {
    method: "POST",
    headers: cabecalhos,
    body: JSON.stringify({ samples }),
  });
  if (!resposta.ok) {
    const err = await resposta.json().catch(() => ({}));
    throw new Error(err.detail || "Falha ao enviar amostras para o backend");
  }
  return await resposta.json();
}

export type StatusJobTreino = {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  epoch: number;
  epochs: number;
  classes: string[];
  validation_accuracy?: number;
  validation_loss?: number;
  result?: Record<string, unknown>;
  error?: string;
};

/** POST /v1/train — inicia o treinamento neural no backend */
export async function iniciarTreinoModelo(
  epochs = 160,
  minimoAmostrasPorClasse = 20,
  solicitadoPor = "web-user",
): Promise<StatusJobTreino> {
  const cabecalhos: HeadersInit = { "Content-Type": "application/json" };
  const chave = apiKeyLibras();
  if (chave) cabecalhos["X-API-Key"] = chave;

  const resposta = await fetch(`${baseUrlLibras()}/v1/train`, {
    method: "POST",
    headers: cabecalhos,
    body: JSON.stringify({
      epochs,
      minimum_samples_per_class: minimoAmostrasPorClasse,
      requested_by: solicitadoPor,
    }),
  });

  const payload = await resposta.json().catch(() => ({}));
  if (!resposta.ok && resposta.status !== 409) {
    throw new Error(payload.detail || `Erro ao iniciar treino (HTTP ${resposta.status})`);
  }
  return payload.job || payload;
}

/** GET /v1/train/{jobId} — consulta o status do job de treino */
export async function consultarJobTreino(jobId: string): Promise<StatusJobTreino> {
  return consultarTreinamento(
    `/v1/train/${encodeURIComponent(jobId)}`,
    "Falha ao consultar treinamento",
  );
}

/** Acompanha o treinamento até a conclusão (retorna o job finalizado) */
export async function aguardarTreino(
  jobId: string,
  aoProgredir?: (status: StatusJobTreino) => void,
  tempoMaximoMs = 180000,
): Promise<StatusJobTreino> {
  const inicio = Date.now();
  while (Date.now() - inicio < tempoMaximoMs) {
    const job = await consultarJobTreino(jobId);
    if (aoProgredir) aoProgredir(job);
    if (job.status === "completed" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("O treinamento demorou mais do que o esperado. Consulte o backend.");
}
