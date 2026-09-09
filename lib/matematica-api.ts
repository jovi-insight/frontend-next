import { BASE_URL } from "./api";
import type { PedidoMatematico } from "./matematica-avancada";

export type FormulaReconhecida = PedidoMatematico & { confianca: "alta" | "media" | "baixa"; observacao: string | null };
export async function lerFormula(imagem: Blob, signal: AbortSignal): Promise<FormulaReconhecida> {
  const dados = new FormData();
  dados.append("imagem", imagem, "formula.jpg");
  const resposta = await fetch(`${BASE_URL}/matematica/ler-formula`, { method: "POST", body: dados, signal });
  if (resposta.status === 404) throw new Error("A leitura avançada ainda não está publicada no backend. Você pode digitar a fórmula e calcular localmente.");
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
