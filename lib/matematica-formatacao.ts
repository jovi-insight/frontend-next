import { revisarDivisaoImplicita } from "./matematica";

/** Apenas tipografia: não calcula, simplifica, reordena nem inventa agrupamento. */
export function formulaParaLatex(entrada: string): string | null {
  if (!entrada.trim() || entrada.length > 1400) return null;
  const texto = entrada.trim().replace(/^\$\$?([\s\S]*?)\$\$?$/, "$1");
  if (texto.includes("\\")) return texto; // KaTeX valida; comandos confiáveis continuam desabilitados.
  if (revisarDivisaoImplicita(texto)) return null;
  const normal = texto.replace(/\*\*/g, "^").replace(/[×·⋅]/g, "*").replace(/÷/g, "/")
    .replace(/[−–]/g, "-").replace(/²/g, "^2").replace(/³/g, "^3");
  const tokens = normal.match(/\d+(?:[.,]\d+)?|[A-Za-z]+|[π∞]|[^\s]/g) || [];
  if (tokens.length > 300) return null;
  let i = 0, profundidade = 0;
  const ver = () => tokens[i];
  const consumir = (valor: string) => { if (tokens[i++] !== valor) throw new Error("Incompleta"); };
  function atomo(): string {
    if (++profundidade > 32) throw new Error("Longa");
    try {
      const t = tokens[i++];
      if (t === "(") { const valor = soma(); consumir(")"); return `\\left(${valor}\\right)`; }
      if (/^(?:\d+(?:[.,]\d+)?)$/.test(t || "")) return t.replace(",", "{,}");
      if (t === "pi" || t === "π") return "\\pi";
      if (t === "∞") return "\\infty";
      if (/^(?:sqrt|sin|cos|tan|ln|log|exp|abs|sen)$/.test(t || "")) {
        consumir("("); const arg = soma(); consumir(")");
        if (t === "sqrt") return `\\sqrt{${arg}}`;
        if (t === "abs") return `\\left|${arg}\\right|`;
        return `\\${t === "sen" ? "sin" : t}\\left(${arg}\\right)`;
      }
      if (/^[a-zA-Z]$/.test(t || "")) {
        let nome = t;
        while (ver() === "'") { i++; nome += "'"; }
        return nome;
      }
      throw new Error("Notação não suportada");
    } finally { profundidade--; }
  }
  function potencia(): string {
    let valor = atomo();
    if (ver() === "^") { i++; valor = `{${valor}}^{${unario()}}`; }
    return valor;
  }
  function unario(): string {
    if (++profundidade > 32) throw new Error("Longa");
    try {
      if (ver() === "+" || ver() === "-") return tokens[i++] + unario();
      return potencia();
    } finally { profundidade--; }
  }
  function produto(): string {
    let valor = unario();
    while (i < tokens.length) {
      const op = ver(), implicito = /^(?:\d|[a-zA-Zπ(])/.test(op || "");
      if (op !== "*" && op !== "/" && !implicito) break;
      if (!implicito) i++;
      const outro = unario();
      valor = op === "/" ? `\\frac{${valor}}{${outro}}` : valor + (implicito ? "\\," : "\\times ") + outro;
    }
    return valor;
  }
  function soma(): string {
    let valor = produto();
    while (ver() === "+" || ver() === "-") valor += " " + tokens[i++] + " " + produto();
    return valor;
  }
  try {
    let valor = soma();
    while (["=", "≈", "≠", "≤", "≥", "<", ">"].includes(ver())) {
      const op = tokens[i++];
      const relacao: Record<string, string> = { "≈": "\\approx", "≠": "\\ne", "≤": "\\le", "≥": "\\ge" };
      valor += " " + (relacao[op] || op) + " " + soma();
    }
    return i === tokens.length ? valor : null;
  } catch { return null; }
}
