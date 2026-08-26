/**
 * Páginas de uma aula em captura.
 *
 * Funções puras, sem DOM: recebem a lista e devolvem outra. A imagem em si
 * fica aqui (data URL) até o aluno concluir — o cache do backend expira em
 * 300s e uma aula dura bem mais.
 */

/**
 * "pendente" é o estado de quem acabou de ser fotografada: a OCR só roda ao
 * concluir a aula. Ler durante a captura disparava várias chamadas de IA em
 * paralelo, e o Gemini derrubava as excedentes com 502.
 */
export type EstadoPagina = "pendente" | "lendo" | "pronta" | "falhou";

export type Pagina = {
  id: string;
  /** Data URL da foto em resolução cheia, o que sobe no fim. */
  imagem: string;
  /** Data URL reduzida, para a tira de miniaturas. */
  miniatura: string;
  texto: string | null;
  estado: EstadoPagina;
};

export function criarPagina(imagem: string, miniatura: string): Pagina {
  return {
    // A OCR volta assíncrona e fora de ordem; o id é o que liga a resposta
    // à página certa.
    id: `pag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    imagem,
    miniatura,
    texto: null,
    estado: "pendente",
  };
}

export function marcarTexto(paginas: Pagina[], id: string, texto: string): Pagina[] {
  return paginas.map((p) =>
    p.id === id ? { ...p, texto: texto.trim(), estado: "pronta" as const } : p,
  );
}

export function marcarLendo(paginas: Pagina[], id: string): Pagina[] {
  return paginas.map((p) => (p.id === id ? { ...p, estado: "lendo" as const } : p));
}

export function marcarFalha(paginas: Pagina[], id: string): Pagina[] {
  return paginas.map((p) => (p.id === id ? { ...p, estado: "falhou" as const } : p));
}

export function removerPagina(paginas: Pagina[], id: string): Pagina[] {
  return paginas.filter((p) => p.id !== id);
}

/**
 * Texto da aula inteira, na ordem de captura.
 *
 * O separador existe para o Gemini não colar o fim de um quadro no começo do
 * outro — e é o que faz /ia/resumo e /ia/quiz cobrirem a aula toda.
 */
/**
 * As imagens da aula não cabem no localStorage (data URLs de fotos estouram a
 * cota de ~5 MB). Ficam aqui entre a câmera e a tela de organizar, que são a
 * mesma sessão de navegação — é memória, não persistência.
 */
export const janelaDeAula: { blobs: Blob[] } = { blobs: [] };

export function textoDaAula(paginas: Pagina[]): string {
  return paginas
    .map((p, i) => {
      const cabecalho = `[Página ${i + 1}]`;
      if (p.estado === "falhou" || !p.texto) return `${cabecalho} (não foi possível ler)`;
      return `${cabecalho}\n${p.texto}`;
    })
    .join("\n\n");
}
