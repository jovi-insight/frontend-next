/**
 * Guia de estudo e termos-chave do resumo. Porte enxuto do que o
 * frontend/js/ai-engine.js fazia: funções puras, sem DOM e sem rede — o
 * backend já devolveu o resumo, isto só o recorta para a tela.
 */

const STOPWORDS = new Set(
  ("a o e é são que de do da dos das um uma uns umas para com em no na nos nas se como por mais " +
    "os as ao aos à às isso isto esse esta este esses estes essas ele ela eles elas eu tu nós vós " +
    "você vocês meu minha seu sua nosso nossa tem ter foi foram ser estar está estão estava " +
    "estavam estou estamos aquele aquela aquilo também muito muita muitos muitas pouco pouca só " +
    "ainda já sim não mas ou porque quando onde qual quais quanto cada todo toda todos todas pelo " +
    "pela pelos pelas entre sobre até dessa desse deste desta").split(" "),
);

function tokenizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2 && !STOPWORDS.has(p));
}

/** Pontos do guia de estudo: as primeiras frases com algum conteúdo. */
export function pontosDeEstudo(texto: string, quantos = 5): string[] {
  return (texto || "")
    .split(/[.!?\n]/)
    .map((f) => f.trim())
    .filter((f) => f.length > 25)
    .slice(0, quantos);
}

/** Termos-chave por frequência, ignorando palavras curtas e de ligação. */
export function termosChave(texto: string, quantos = 6): string[] {
  const freq = new Map<string, number>();
  for (const t of tokenizar(texto || "")) {
    if (t.length < 4) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, quantos)
    .map(([termo]) => termo.charAt(0).toUpperCase() + termo.slice(1));
}
