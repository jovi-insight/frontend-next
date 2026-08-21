/**
 * Cliente da API JOVI (FastAPI).
 *
 * Porte de frontend/js/api-client.js com os tipos das respostas. Mesmas rotas,
 * mesmo contrato — o backend não muda por causa da migração.
 */

export const BASE_URL = "https://backend-rhlz.onrender.com";

// ─── Tipos das respostas ──────────────────────────────────
export type Imagem = { id: string; id_conteudo: string; url_storage: string };

export type Video = { id: string; url: string; titulo: string };

export type Conteudo = {
  id: string;
  user_id: string;
  pasta_id: string | null;
  extracao_original: string;
  resumo_ia: string | null;
  ultima_atualizacao: string;
  imagens: Imagem[];
  videos: Video[];
  /** Presente em /dashboard/recentes, ausente no detalhe. */
  imagem_url?: string;
};

export type Pergunta = {
  id: string;
  id_conteudo: string;
  pergunta: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  resposta_correta: string;
  explicacao: string | null;
  criado_em?: string;
};

export type Quiz = { conteudo_id: string; perguntas: Pergunta[] };

export type Pasta = {
  id: string;
  nome: string;
  id_materia: string | null;
  quantidade_arquivos?: number;
  user_id?: string;
};

/** GET /pastas/{id} traz os conteúdos junto. */
export type PastaDetalhe = Pasta & { conteudos: Conteudo[] };

export type Materia = { id: string; nome: string };

export type AnaliseImagem = {
  texto_extraido: string;
  materia_sugerida_id: string | null;
  cache_id: string;
};

// ─── Helpers ──────────────────────────────────────────────
async function handle<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    let detalhe = fallback;
    try {
      const corpo = await res.json();
      detalhe = corpo.detail || corpo.message || fallback;
    } catch {
      /* corpo não-JSON */
    }
    throw new Error(detalhe);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function pedirJson(caminho: string, metodo: string, corpo?: unknown) {
  return fetch(`${BASE_URL}${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

/** Distingue UUID do backend de ids locais legados ("cont-xyz"). */
export function isUuid(valor: unknown): valor is string {
  return (
    typeof valor === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
  );
}

// ─── IA ───────────────────────────────────────────────────
export async function analisarImagem(arquivo: Blob): Promise<AnaliseImagem> {
  const form = new FormData();
  form.append("imagem", arquivo, "capture.jpg");
  const res = await fetch(`${BASE_URL}/ia/analisar-imagem`, {
    method: "POST",
    body: form,
  });
  return handle(res, "Falha na análise da imagem");
}

export async function gerarResumo(conteudoId: string): Promise<{ resumo: string }> {
  const res = await pedirJson("/ia/resumo", "POST", { conteudo_id: conteudoId });
  return handle(res, "Falha ao gerar resumo");
}

/** MP3 da narração. Idiomas: pt, en, es, fr, de, it, ja, ko, zh. */
export async function narrar(texto: string, idioma = "pt"): Promise<Blob> {
  const res = await pedirJson("/ia/narrar", "POST", { texto, idioma });
  if (!res.ok) await handle(res, "Falha ao gerar narração"); // handle() lança
  return await res.blob();
}

export async function traduzirTexto(
  texto: string,
  idiomaDestino = "português brasileiro",
): Promise<{ traducao: string }> {
  const res = await pedirJson("/ia/traduzir-texto", "POST", {
    texto,
    idioma_destino: idiomaDestino,
  });
  return handle(res, "Falha na tradução do texto");
}

/**
 * Gera perguntas de múltipla escolha.
 * ATENÇÃO: o backend ACUMULA — duas chamadas somam as perguntas no banco
 * (verificado: 3 + 2 devolve 5 no GET). A resposta traz só as novas.
 */
export async function gerarQuiz(conteudoId: string, numPerguntas = 5): Promise<Quiz> {
  const res = await pedirJson("/ia/quiz", "POST", {
    conteudo_id: conteudoId,
    num_perguntas: numPerguntas,
  });
  return handle(res, "Falha ao gerar o quiz");
}

/** Quiz já gravado, ou null quando ainda não existe (404 não é erro aqui). */
export async function getQuiz(conteudoId: string): Promise<Quiz | null> {
  const res = await fetch(`${BASE_URL}/ia/quiz/${conteudoId}`);
  if (res.status === 404) return null;
  return handle(res, "Falha ao buscar o quiz");
}

// ─── Conteúdo ─────────────────────────────────────────────
export async function getConteudo(conteudoId: string): Promise<Conteudo> {
  const res = await fetch(`${BASE_URL}/conteudo/${conteudoId}`);
  return handle(res, "Falha ao buscar conteúdo");
}

/**
 * Confirma o scan: grava o conteúdo, sobe a imagem e pede os vídeos à IA.
 * Leva alguns segundos — é a chamada mais lenta do fluxo de captura.
 */
export async function confirmarConteudo(
  cacheId: string,
  materiaId: string,
  textoExtraido: string,
): Promise<Conteudo> {
  // Os três campos são obrigatórios no ConteudoConfirmarRequest; mandar o
  // texto de volta é o que permite o aluno corrigir a OCR antes de salvar.
  const res = await pedirJson("/conteudo/confirmar", "POST", {
    cache_id: cacheId,
    id_materia: materiaId,
    texto_extraido: textoExtraido,
  });
  return handle(res, "Falha ao confirmar o conteúdo");
}

export async function getRecentes(): Promise<Conteudo[]> {
  const res = await fetch(`${BASE_URL}/dashboard/recentes`);
  return handle(res, "Falha ao carregar recentes");
}

// ─── Pastas e matérias ────────────────────────────────────
export async function getPastas(): Promise<Pasta[]> {
  const res = await fetch(`${BASE_URL}/pastas`);
  return handle(res, "Falha ao carregar pastas");
}

export async function getMaterias(): Promise<Materia[]> {
  const res = await fetch(`${BASE_URL}/materias`);
  return handle(res, "Falha ao carregar matérias");
}

export async function getPasta(pastaId: string): Promise<PastaDetalhe> {
  const res = await fetch(`${BASE_URL}/pastas/${pastaId}`);
  return handle(res, "Falha ao carregar a pasta");
}

export async function renomearPasta(pastaId: string, nome: string): Promise<Pasta> {
  const res = await pedirJson(`/pastas/${pastaId}`, "PUT", { nome });
  return handle(res, "Falha ao renomear a pasta");
}

/** Soft delete: a pasta some da listagem junto com os conteúdos dela. */
export async function excluirPasta(pastaId: string): Promise<null> {
  const res = await fetch(`${BASE_URL}/pastas/${pastaId}`, { method: "DELETE" });
  return handle(res, "Falha ao excluir a pasta");
}

export async function criarMateria(nome: string): Promise<Materia> {
  const res = await pedirJson("/materias", "POST", { nome });
  return handle(res, "Falha ao criar matéria");
}
