/**
 * Segmentação de texto em blocos do Modo Foco.
 * Porte de frontend/js/focus-blocks.js — funções puras, sem DOM.
 */

// Abreviações comuns em português que terminam em ponto sem encerrar frase.
const ABREVIACOES = [
  "sr", "sra", "srs", "dr", "dra", "prof", "profa", "etc", "ex", "p.ex",
  "fig", "pag", "pág", "num", "núm", "art", "av", "ed", "obs", "ref",
];

const FIM_DE_FRASE = ".!?…";
const LIMITE_TITULO = 60;

export type Bloco = { titulo: string | null; frases: string[] };

export function normalizarTexto(texto: unknown): string {
  return String(texto ?? "").replace(/\s+/g, " ").trim();
}

export function contarPalavras(texto: unknown): number {
  return String(texto ?? "").trim().split(/\s+/).filter(Boolean).length;
}

function ehAbreviacao(texto: string, posicaoDoPonto: number): boolean {
  const trecho = texto.slice(Math.max(0, posicaoDoPonto - 12), posicaoDoPonto);
  const encontrado = trecho.match(/([\p{L}.]+)$/u);
  if (!encontrado) return false;
  return ABREVIACOES.includes(encontrado[1].toLowerCase());
}

export function dividirFrases(texto: string): string[] {
  const alvo = normalizarTexto(texto);
  const frases: string[] = [];
  let inicio = 0;

  for (let i = 0; i < alvo.length; i++) {
    if (!FIM_DE_FRASE.includes(alvo[i])) continue;

    // Decimal: 3.14 não encerra frase.
    if (alvo[i] === "." && /\d/.test(alvo[i - 1] ?? "") && /\d/.test(alvo[i + 1] ?? "")) continue;

    // Abreviação: "Sr." não encerra frase.
    if (alvo[i] === "." && ehAbreviacao(alvo, i)) continue;

    // Consome pontuação repetida ("..." e "!!" são um fim só).
    let fim = i;
    while (fim + 1 < alvo.length && FIM_DE_FRASE.includes(alvo[fim + 1])) fim++;

    // Ponto colado na próxima palavra ("p.ex") não encerra frase.
    const resto = alvo.slice(fim + 1);
    if (resto.length && !/^\s/.test(resto)) {
      i = fim;
      continue;
    }

    const frase = alvo.slice(inicio, fim + 1).trim();
    if (frase) frases.push(frase);
    inicio = fim + 1;
    i = fim;
  }

  const sobra = alvo.slice(inicio).trim();
  if (sobra) frases.push(sobra);
  return frases;
}

function ehTitulo(linha: string): boolean {
  if (linha.length > LIMITE_TITULO) return false;
  return !FIM_DE_FRASE.includes(linha[linha.length - 1]);
}

export function dividirEmBlocos(texto: string, alvoPalavras = 150): Bloco[] {
  const paragrafos = String(texto ?? "")
    .split(/\n\s*\n/)
    .map(normalizarTexto)
    .filter(Boolean);

  const blocos: Bloco[] = [];
  let atual: Bloco | null = null;

  const abrirBloco = (titulo: string | null) => {
    atual = { titulo, frases: [] };
    blocos.push(atual);
  };

  const palavrasDoBloco = (bloco: Bloco) =>
    bloco.frases.reduce((total, f) => total + contarPalavras(f), 0);

  for (const paragrafo of paragrafos) {
    if (ehTitulo(paragrafo)) {
      abrirBloco(paragrafo);
      continue;
    }
    for (const frase of dividirFrases(paragrafo)) {
      if (!atual) abrirBloco(null);
      // Nunca corta uma frase: só abre bloco novo quando o atual atingiu o alvo.
      if (atual!.frases.length && palavrasDoBloco(atual!) >= alvoPalavras) abrirBloco(null);
      atual!.frases.push(frase);
    }
  }

  return blocos.filter((bloco) => bloco.frases.length > 0);
}
