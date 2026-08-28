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
  conteudo_lixo: boolean;
  motivo_lixo: string | null;
};

export type VideoUsuario = {
  id: string;
  nome: string;
  mime_type: string;
  tamanho: number;
  duracao: number;
  url_storage: string;
  transcricao: Record<string, unknown> | null;
  resumo: string | null;
  criado_em: string;
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

/** Traduz o que está escrito numa imagem (o backend faz OCR + tradução). */
export async function traduzirImagem(arquivo: Blob): Promise<{ traducao: string }> {
  const form = new FormData();
  form.append("imagem", arquivo, "traduzir.jpg");
  const res = await fetch(`${BASE_URL}/ia/traduzir-imagem`, { method: "POST", body: form });
  return handle(res, "Falha na tradução da imagem");
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

/**
 * Salva uma aula: várias páginas do quadro em um único conteúdo.
 *
 * As imagens vão no corpo, e não pelo cache do backend, porque o cache expira
 * em 300s e uma aula dura bem mais. Resumo e quiz saem da aula inteira porque
 * o texto concatenado vira o `extracao_original` do conteúdo.
 */
export async function criarAula(
  imagens: Blob[],
  materiaId: string,
  textoExtraido: string,
): Promise<Conteudo> {
  const form = new FormData();
  imagens.forEach((imagem, i) => form.append("imagens", imagem, `pagina-${i + 1}.jpg`));
  form.append("id_materia", materiaId);
  form.append("texto_extraido", textoExtraido);

  const res = await fetch(`${BASE_URL}/conteudo/aula`, { method: "POST", body: form });
  return handle(res, "Falha ao salvar a aula");
}

/**
 * Documentos do usuário, do mais novo para o mais antigo.
 *
 * O padrão da rota é 4 (era o do painel inicial) — a galeria precisa de tudo,
 * senão o quinto documento em diante fica inalcançável fora da tela de pastas.
 * Backends antigos ignoram o parâmetro e seguem devolvendo 4.
 */
export async function getRecentes(limite = 100): Promise<Conteudo[]> {
  const res = await fetch(`${BASE_URL}/dashboard/recentes?limit=${limite}`, {
    cache: "no-store",
  });
  return handle(res, "Falha ao carregar recentes");
}

/** Documentos na lixeira compartilhada pelo backend. */
export async function getLixeira(): Promise<Conteudo[]> {
  const res = await fetch(`${BASE_URL}/conteudo/lixeira`, { cache: "no-store" });
  return handle(res, "Falha ao carregar a lixeira");
}

/** Soft delete recuperável e sincronizado entre aparelhos. */
export async function moverConteudoParaLixeira(conteudoId: string): Promise<null> {
  const res = await fetch(`${BASE_URL}/conteudo/${conteudoId}`, { method: "DELETE" });
  return handle(res, "Falha ao mover o documento para a lixeira");
}

export async function restaurarConteudo(conteudoId: string): Promise<Conteudo> {
  const res = await fetch(`${BASE_URL}/conteudo/${conteudoId}/restaurar`, {
    method: "POST",
  });
  return handle(res, "Falha ao restaurar o documento");
}

/** Purge definitivo do documento, banco e arquivos do Storage. */
export async function excluirConteudoPermanentemente(conteudoId: string): Promise<null> {
  const res = await fetch(`${BASE_URL}/conteudo/${conteudoId}/permanente`, {
    method: "DELETE",
  });
  return handle(res, "Falha ao excluir o documento definitivamente");
}

// ─── Vídeos do usuário ───────────────────────────────────
export async function enviarVideoUsuario(
  arquivo: File,
  duracao = 0,
): Promise<VideoUsuario> {
  const form = new FormData();
  form.append("arquivo", arquivo, arquivo.name || "video.webm");
  form.append("duracao", String(Math.max(0, Number(duracao) || 0)));
  const res = await fetch(`${BASE_URL}/videos`, { method: "POST", body: form });
  return handle(res, "Falha ao sincronizar o vídeo");
}

export async function listarVideosUsuario(): Promise<VideoUsuario[]> {
  const res = await fetch(`${BASE_URL}/videos`);
  return handle(res, "Falha ao carregar os vídeos do banco");
}

export async function obterVideoUsuario(id: string): Promise<VideoUsuario> {
  const res = await fetch(`${BASE_URL}/videos/${id}`);
  return handle(res, "Falha ao buscar o vídeo no banco");
}

export async function atualizarVideoUsuario(
  id: string,
  dados: { transcricao?: Record<string, unknown> | null; resumo?: string | null },
): Promise<VideoUsuario> {
  const res = await pedirJson(`/videos/${id}`, "PATCH", dados);
  return handle(res, "Falha ao atualizar o vídeo no banco");
}

export async function removerVideoUsuario(id: string): Promise<null> {
  const res = await fetch(`${BASE_URL}/videos/${id}`, { method: "DELETE" });
  return handle(res, "Falha ao remover o vídeo do banco");
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
