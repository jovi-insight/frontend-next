import { BASE_URL } from "./api";
import type { PedidoMatematico } from "./matematica-avancada";

export type FormulaReconhecida = PedidoMatematico & { confianca: "alta" | "media" | "baixa"; observacao: string | null };
export async function lerFormula(imagem: Blob, signal: AbortSignal): Promise<FormulaReconhecida> {
  const dados = new FormData();
  dados.append("imagem", imagem, "formula.jpg");
  const resposta = await fetch(`${BASE_URL}/matematica/ler-formula`, { method: "POST", body: dados, signal });
  if (resposta.status === 404) throw new Error("A leitura com IA ainda não está publicada no backend.");
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new Error(typeof corpo?.detail === "string" ? corpo.detail : "Não foi possível ler a fórmula. Tente novamente ou digite.");
  }
  const corpo: FormulaReconhecida = await resposta.json();
  if (typeof corpo.expressao !== "string" || corpo.expressao.length > 240 ||
    !["auto", "derivar", "integrar", "definida", "resolver"].includes(corpo.operacao) ||
    typeof corpo.variavel !== "string" || !/^[a-df-hj-zA-Z]$/.test(corpo.variavel) ||
    !["alta", "media", "baixa"].includes(corpo.confianca) ||
    [corpo.inferior, corpo.superior].some((v) => v != null && (typeof v !== "string" || v.length > 60)) ||
    (corpo.observacao != null && (typeof corpo.observacao !== "string" || corpo.observacao.length > 300))) {
    throw new Error("A IA retornou uma leitura inválida. Digite a expressão para continuar.");
  }
  return corpo;
}

export type ResolucaoIA = {
  status: "resolvido" | "precisa_informacao" | "nao_resolvido";
  resultado: string | null;
  passos: { titulo: string; explicacao: string; formula: string | null }[];
  aviso: string | null;
  pergunta: string | null;
};

export async function resolverFormula(pedido: PedidoMatematico, signal: AbortSignal): Promise<ResolucaoIA> {
  const resposta = await fetch(`${BASE_URL}/matematica/resolver`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedido), signal,
  });
  if (resposta.status === 404) throw new Error("A resolução com passo a passo ainda não está publicada no backend.");
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(typeof corpo?.detail === "string" ? corpo.detail : "Não foi possível resolver com IA. Confira a expressão e os campos da operação.");
  const texto = (valor: unknown, maximo: number) => typeof valor === "string" && !!valor.trim() && valor.length <= maximo;
  const opcional = (valor: unknown, maximo: number) => valor == null || (typeof valor === "string" && valor.length <= maximo);
  if (!corpo || !["resolvido", "precisa_informacao", "nao_resolvido"].includes(corpo.status) ||
    !Array.isArray(corpo.passos) || corpo.passos.length > 12 ||
    !corpo.passos.every((passo: ResolucaoIA["passos"][number]) => passo && texto(passo.titulo, 100) && texto(passo.explicacao, 900) && opcional(passo.formula, 600)) ||
    !opcional(corpo.aviso, 600) || !opcional(corpo.pergunta, 400) ||
    (corpo.status === "resolvido" ? !texto(corpo.resultado, 1400) || !corpo.passos.length : corpo.resultado != null || corpo.passos.length || !texto(corpo.pergunta, 400))) {
    throw new Error("A IA não retornou um passo a passo válido. Nenhuma solução parcial foi exibida.");
  }
  return corpo;
}
