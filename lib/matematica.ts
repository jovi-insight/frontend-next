/** Motor restrito e determinístico. Nunca executa texto reconhecido como código. */
export type SolucaoMatematica = {
  expressao: string;
  resultado: string;
  passos: string[];
  tipo: "conta" | "equacao" | "derivada" | "integral" | "formula";
  aviso?: string;
};
export type RevisaoMatematica = { expressao: string; alternativas: { expressao: string; descricao: string }[] };
export type AnaliseMatematica =
  | { ok: true; solucao: SolucaoMatematica }
  | { ok: false; motivo: string; revisao?: RevisaoMatematica };

/** Só remove uma indicação de resposta, nunca interrogações dentro da conta. */
export const removerSufixoPergunta = (texto: string) => texto.replace(/=\s*[?？]\s*$/, "").trim();

export function revisarDivisaoImplicita(texto: string): RevisaoMatematica | null {
  const expressao = removerSufixoPergunta(texto).replace(/÷/g, "/");
  const ocorrencias = [...expressao.matchAll(/\/\s*(\d+(?:[.,]\d+)?)\s*\(/g)];
  if (!ocorrencias.length) return null;
  const match = ocorrencias[0], inicio = match.index!, abertura = inicio + match[0].length - 1;
  let fim = abertura, nivel = 0;
  for (; fim < expressao.length; fim++) {
    if (expressao[fim] === "(") nivel++;
    if (expressao[fim] === ")" && --nivel === 0) break;
  }
  // Mais de uma ambiguidade exige edição explícita, sem criar uma árvore de palpites.
  if (fim === expressao.length || ocorrencias.length > 1) return { expressao, alternativas: [] };
  return { expressao, alternativas: [
    { expressao: expressao.slice(0, inicio) + `/${match[1]}*` + expressao.slice(abertura), descricao: "Dividir e depois multiplicar" },
    { expressao: expressao.slice(0, inicio) + `/(${match[1]}*` + expressao.slice(abertura, fim + 1) + ")" + expressao.slice(fim + 1), descricao: "Dividir pelo produto inteiro" },
  ] };
}

type Fracao = { n: bigint; d: bigint };
type Linear = { a: Fracao; b: Fracao; texto: string };
const ZERO: Fracao = { n: 0n, d: 1n };
const UM: Fracao = { n: 1n, d: 1n };
const abs = (n: bigint) => n < 0n ? -n : n;

function fracao(n: bigint, d = 1n): Fracao {
  if (!d) throw new Error("Divisão por zero não é definida.");
  if (n.toString().length > 100 || d.toString().length > 100) {
    throw new Error("Esta conta ultrapassa o limite do modo rápido.");
  }
  if (d < 0n) { n = -n; d = -d; }
  let a = abs(n), b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
const soma = (a: Fracao, b: Fracao) => fracao(a.n * b.d + b.n * a.d, a.d * b.d);
const negativo = (a: Fracao) => ({ n: -a.n, d: a.d });
const produto = (a: Fracao, b: Fracao) => fracao(a.n * b.n, a.d * b.d);
const divide = (a: Fracao, b: Fracao) => fracao(a.n * b.d, a.d * b.n);

function numero(texto: string): Fracao {
  const [inteiro, decimal = ""] = texto.split(".");
  if (inteiro.length + decimal.length > 14) throw new Error("Use números com até 14 algarismos.");
  return fracao(BigInt((inteiro || "0") + decimal), 10n ** BigInt(decimal.length));
}

/** Decimais exatos; dízimas permanecem frações em vez de inventar precisão. */
function formato(f: Fracao): string {
  if (f.d === 1n) return String(f.n);
  let resto = f.d;
  while (resto % 2n === 0n) resto /= 2n;
  while (resto % 5n === 0n) resto /= 5n;
  if (resto !== 1n) return `${f.n}/${f.d}`;
  let decimal = "", r = abs(f.n) % f.d;
  while (r && decimal.length < 14) {
    r *= 10n;
    decimal += r / f.d;
    r %= f.d;
  }
  if (r) return `${f.n}/${f.d}`;
  return `${f.n < 0n ? "-" : ""}${abs(f.n) / f.d},${decimal}`;
}

function formaLinear(v: Linear): string {
  if (!v.a.n) return formato(v.b);
  const coef = v.a.n === v.a.d ? "" : v.a.n === -v.a.d ? "-" : `(${formato(v.a)})`;
  return `${coef}x${v.b.n ? ` ${v.b.n > 0n ? "+" : "-"} ${formato(fracao(abs(v.b.n), v.b.d))}` : ""}`;
}

function normalizar(entrada: string): string {
  let texto = removerSufixoPergunta(entrada.trim());
  if (texto.length > 120) throw new Error("Enquadre apenas uma conta curta.");
  if (/[\r\n]/.test(texto)) throw new Error("Enquadre uma única linha de matemática.");
  texto = texto.replace(/[−–—]/g, "-").replace(/[×·⋅]/g, "*")
    .replace(/÷/g, "/").replace(/²/g, "^2").replace(/³/g, "^3")
    .replace(/,/g, ".").replace(/X/g, "x");
  if (!/^[\d\s.x+*/^()=\-]+$/.test(texto)) {
    throw new Error("Leitura incompleta. Use números, +, −, ×, ÷, parênteses ou uma equação em x.");
  }
  // x entre números é multiplicação; 2x+3 é expressão algébrica, não 2*(+3).
  if (!texto.includes("=") || /=\s*$/.test(texto)) {
    texto = texto.replace(/(\d|\))\s*x\s*(?=[\d(])/g, "$1*");
  }
  if (/=\s*$/.test(texto)) texto = texto.replace(/=\s*$/, "");
  return texto.trim();
}

class Leitor {
  private i = 0;
  private tokens: string[];
  constructor(texto: string, private passos: string[]) {
    this.tokens = texto.match(/\d+(?:\.\d+)?|\.\d+|[^\s]/g) || [];
    if (this.tokens.length > 70) throw new Error("Esta expressão é longa demais para o modo rápido.");
  }
  private atual() { return this.tokens[this.i]; }
  ler(): Linear {
    const valor = this.adicao();
    if (this.i !== this.tokens.length) throw new Error("Confira os símbolos: a expressão está incompleta ou ambígua.");
    return valor;
  }
  private registrar(a: Linear, b: Linear, op: string, valor: Linear): Linear {
    if (!a.a.n && !b.a.n) this.passos.push(`${formato(a.b)} ${op} ${formato(b.b)} = ${formato(valor.b)}`);
    return valor;
  }
  private adicao(): Linear {
    let valor = this.multiplicacao();
    while (this.atual() === "+" || this.atual() === "-") {
      const op = this.tokens[this.i++], outro = this.multiplicacao();
      const a = op === "+" ? outro.a : negativo(outro.a);
      const b = op === "+" ? outro.b : negativo(outro.b);
      valor = this.registrar(valor, outro, op, {
        a: soma(valor.a, a), b: soma(valor.b, b), texto: `(${valor.texto}${op}${outro.texto})`,
      });
    }
    return valor;
  }
  private multiplicacao(): Linear {
    let valor = this.unario();
    while (true) {
      const proximo = this.atual();
      const implicito = proximo === "(" || proximo === "x";
      if (proximo !== "*" && proximo !== "/" && !implicito) break;
      const op = implicito ? "*" : this.tokens[this.i++];
      const outro = this.unario();
      let a: Fracao, b: Fracao;
      if (op === "/") {
        if (outro.a.n) throw new Error("O modo rápido ainda não resolve x no denominador.");
        a = divide(valor.a, outro.b); b = divide(valor.b, outro.b);
      } else {
        if (valor.a.n && outro.a.n) throw new Error("Por enquanto, use equações de primeiro grau.");
        a = soma(produto(valor.a, outro.b), produto(valor.b, outro.a));
        b = produto(valor.b, outro.b);
      }
      valor = this.registrar(valor, outro, op === "*" ? "×" : "÷", {
        a, b, texto: `(${valor.texto}${op}${outro.texto})`,
      });
    }
    return valor;
  }
  private unario(): Linear {
    if (this.atual() === "+" || this.atual() === "-") {
      const op = this.tokens[this.i++], v = this.unario();
      return op === "-" ? { a: negativo(v.a), b: negativo(v.b), texto: `-${v.texto}` } : v;
    }
    return this.potencia();
  }
  private potencia(): Linear {
    const base = this.primario();
    if (this.atual() !== "^") return base;
    this.i++;
    const expoente = this.unario();
    if (expoente.a.n || expoente.b.d !== 1n || abs(expoente.b.n) > 12n) {
      throw new Error("Use expoentes inteiros entre -12 e 12.");
    }
    const e = expoente.b.n;
    if (base.a.n && e !== 1n) throw new Error("Por enquanto, use equações de primeiro grau.");
    if (base.a.n) return base;
    if (base.b.n === 0n && e === 0n) throw new Error("0 elevado a 0 não é definido neste modo.");
    const positivo = fracao(base.b.n ** abs(e), base.b.d ** abs(e));
    const valor = { a: ZERO, b: e < 0n ? divide(UM, positivo) : positivo, texto: `(${base.texto})^${e}` };
    return this.registrar(base, expoente, "^", valor);
  }
  private primario(): Linear {
    const token = this.tokens[this.i++];
    if (token === "(") {
      const valor = this.adicao();
      if (this.tokens[this.i++] !== ")") throw new Error("Feche os parênteses da expressão.");
      return valor;
    }
    if (token === "x") return { a: UM, b: ZERO, texto: "x" };
    if (token && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(token)) {
      return { a: ZERO, b: numero(token), texto: token };
    }
    throw new Error("Aguardando uma expressão completa.");
  }
}

export function resolverMatematica(entrada: string): AnaliseMatematica {
  try {
    const expressao = normalizar(entrada);
    const revisao = revisarDivisaoImplicita(expressao);
    if (revisao) return { ok: false, revisao, motivo: "Divisão com multiplicação implícita: confirme o agrupamento antes de calcular." };
    const partes = expressao.split("=");
    const passos: string[] = [];
    if (partes.length > 2) throw new Error("Enquadre apenas uma conta ou equação.");
    if (!/[+*/^=\-]/.test(expressao)) throw new Error("Aponte para uma conta, não apenas um número.");
    const esquerda = new Leitor(partes[0], passos).ler();
    if (partes.length === 1) {
      if (expressao.includes("x")) throw new Error("Expressão com variável: use o motor simbólico.");
      return { ok: true, solucao: {
        expressao, resultado: formato(esquerda.b), tipo: "conta",
        passos: passos.length ? passos : [`Resultado: ${formato(esquerda.b)}`],
      } };
    }
    const direita = new Leitor(partes[1], passos).ler();
    const a = soma(esquerda.a, negativo(direita.a));
    const b = soma(direita.b, negativo(esquerda.b));
    let resultado: string;
    if (!expressao.includes("x")) {
      resultado = b.n === 0n ? "Igualdade verdadeira" : "Igualdade falsa";
      passos.push(`${formato(esquerda.b)} ${b.n === 0n ? "=" : "≠"} ${formato(direita.b)}`);
    } else if (!a.n) {
      resultado = b.n === 0n ? "Infinitas soluções" : "Sem solução";
      passos.push(`${formaLinear(esquerda)} = ${formaLinear(direita)}`);
      passos.push(b.n === 0n ? "Os dois lados são iguais para qualquer x." : "Os termos em x se anulam, mas os valores são diferentes.");
    } else {
      resultado = `x = ${formato(divide(b, a))}`;
      passos.push(`Simplifique: ${formaLinear(esquerda)} = ${formaLinear(direita)}`);
      passos.push(`Reúna os termos em x de um lado e os números do outro: (${formato(a)})x = ${formato(b)}`);
      passos.push(`Divida os dois lados por ${formato(a)}: ${resultado}`);
    }
    return { ok: true, solucao: { expressao, resultado, passos, tipo: "equacao" } };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : "Não consegui interpretar a conta." };
  }
}
