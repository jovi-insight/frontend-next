import { BASE_URL } from "./api";

export type FotoBiblioteca = {
  id: string; pasta_id: string; materia: string;
  ultima_atualizacao: string | null; imagem_url: string | null;
  miniatura_url: string | null; paginas: number; resumo_pronto: boolean;
};
export type PaginaBiblioteca = { itens: FotoBiblioteca[]; proximo_cursor: string | null };

export function juntarFotos(atuais: FotoBiblioteca[], novas: FotoBiblioteca[]): FotoBiblioteca[] {
  return [...new Map([...atuais, ...novas].map(foto => [foto.id, foto])).values()];
}

export async function carregarBiblioteca(lixeira: boolean, cursor: string | null, signal: AbortSignal): Promise<PaginaBiblioteca> {
  const parametros = new URLSearchParams({ limite: "24", lixeira: String(lixeira) });
  if (cursor) parametros.set("cursor", cursor);
  const resposta = await fetch(`${BASE_URL}/dashboard/biblioteca?${parametros}`, { signal, cache: "no-store" });
  if (!resposta.ok) throw new Error(resposta.status === 404
    ? "A biblioteca leve precisa da atualização do backend."
    : "Não foi possível carregar as fotos. Tente novamente.");
  return resposta.json();
}

export function urlMiniatura(foto: FotoBiblioteca): string | null {
  return foto.miniatura_url ? new URL(foto.miniatura_url, BASE_URL).href : foto.imagem_url;
}
