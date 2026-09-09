import nerdamer from "nerdamer/all.js";
import { resolverMatematica, removerSufixoPergunta, revisarDivisaoImplicita, type AnaliseMatematica, type SolucaoMatematica } from "./matematica";

export type OperacaoMatematica = "auto" | "simplificar" | "avaliar" | "derivar" | "integrar" | "definida" | "resolver";
export type PedidoMatematico = {
  expressao: string;
  operacao: OperacaoMatematica;
  variavel: string;
  inferior?: string;
  superior?: string;
  valor?: string;
};

const FUNCOES = new Set(["sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "sqrt", "abs", "log", "exp", "sec", "csc", "cot"]);
function validarExpressao(entrada: string): string {
  if (entrada.length > 240 || !entrada.trim() || /[\r\n]/.test(entrada.trim())) throw new Error("Use uma única expressão de até 240 caracteres.");
  const texto = entrada.trim().replace(/[−–—]/g, "-").replace(/[×·⋅]/g, "*")
    .replace(/÷/g, "/").replace(/²/g, "^2").replace(/³/g, "^3")
    .replace(/π/g, "pi").replace(/√\s*\(/g, "sqrt(")
    .replace(/\bln\b/g, "log").replace(/\bsen\b/g, "sin")
    .replace(/,/g, ".");
  if (!/^[a-zA-Z0-9\s.+*/^()=\-]+$/.test(texto)) throw new Error("Confira a fórmula. Use / para frações, ^ para potências e sqrt(...) para raízes.");
  if (/\d\s+\d/.test(texto)) throw new Error("Há números separados sem operador. Confira a leitura.");
  if (/[a-zA-Z]\d/.test(texto)) throw new Error("Expoente ou multiplicação ambíguos. Use ^ ou * explicitamente.");
  let profundidade = 0;
  for (const char of texto) {
    if (char === "(" && ++profundidade > 16) throw new Error("Expressão complexa demais para o modo rápido.");
    if (char === ")" && --profundidade < 0) throw new Error("Confira os parênteses.");
  }
  if (profundidade) throw new Error("Confira os parênteses.");
  for (const nome of texto.match(/[a-zA-Z]+/g) || []) {
    if (nome.length > 1 && nome !== "pi" && !FUNCOES.has(nome)) throw new Error(`Símbolo não suportado: ${nome}. Use letras individuais para variáveis.`);
  }
  if (/\^\s*\d{3,}/.test(texto) || /\d{15,}/.test(texto)) throw new Error("Potência ou número grande demais para o modo rápido.");
  if ((texto.match(/=/g) || []).length > 1) throw new Error("Use uma equação por vez.");
  return texto;
}

/** Só executar em Worker no browser: integrais difíceis não podem congelar a câmera. */
export function resolverAvancada(pedido: PedidoMatematico): AnaliseMatematica {
  try {
    const { variavel, inferior, superior } = pedido;
    if (!/^[a-df-hj-zA-Z]$/.test(variavel)) throw new Error("Escolha uma variável de uma letra (e e i são constantes reservadas).");
    if (!["auto", "simplificar", "avaliar", "derivar", "integrar", "definida", "resolver"].includes(pedido.operacao)) throw new Error("Operação não suportada.");
    let operacao = pedido.operacao;
    let entrada = removerSufixoPergunta(pedido.expressao.trim());
    const revisao = revisarDivisaoImplicita(entrada);
    if (revisao) return { ok: false, revisao, motivo: "Divisão com multiplicação implícita: confirme o agrupamento antes de calcular." };
    // Notação curta reconhecível pelo leitor local; notação 2D vai para leitura assistida.
    const derivada = entrada.match(/^d\s*\/\s*d([a-z])\s*(.+)$/i);
    const integral = entrada.match(/^∫\s*(.+?)\s*d([a-z])$/i);
    let v = variavel;
    if (derivada) { operacao = "derivar"; v = derivada[1]; entrada = derivada[2]; }
    if (integral) { operacao = "integrar"; v = integral[2]; entrada = integral[1]; }
    const definicao = entrada.match(/^[fg]\(([a-z])\)\s*=\s*(.+)$/);
    if (definicao) { v = definicao[1]; entrada = definicao[2]; }
    if (!/^[a-df-hj-zA-Z]$/.test(v)) throw new Error("Variável de cálculo não suportada.");
    if (operacao === "auto" && !definicao) {
      const simples = resolverMatematica(entrada);
      if (simples.ok) return simples;
    }
    const expressao = validarExpressao(entrada);
    if (operacao === "auto" && !/[+*/^=\-]/.test(expressao) && !/[a-z]+\(/.test(expressao)) {
      throw new Error("Enquadre uma expressão completa ou selecione uma operação.");
    }
    if (operacao === "auto" && expressao.includes("=")) operacao = "resolver";
    if (expressao.includes("=") && operacao !== "resolver") throw new Error("Selecione Resolver equação ou informe apenas a função.");
    if (operacao === "auto" && nerdamer(expressao).variables().length) {
      throw new Error("Esta imagem define uma função ou expressão com variável, não uma pergunta completa. Escolha Calcular valor, Simplificar, Derivada ou Integral. Para resolver uma equação, informe a igualdade; não vou presumir f(x) = 0.");
    }
    let saida: ReturnType<typeof nerdamer>;
    const passos: string[] = [];
    let tipo: SolucaoMatematica["tipo"] = "formula";
    let aviso = "Confira a expressão reconhecida e seu domínio. Funções trigonométricas usam radianos.";
    if (operacao === "avaliar") {
      if (!pedido.valor?.trim()) throw new Error(`Informe o valor de ${v}.`);
      const valor = validarExpressao(pedido.valor);
      if (valor.includes("=")) throw new Error("Informe um valor numérico finito.");
      const numero = nerdamer(valor).evaluate();
      if (numero.variables().length || !Number.isFinite(Number(numero.text("decimals")))) throw new Error("Informe um valor numérico finito.");
      saida = nerdamer(expressao, { [v]: numero.toString() });
      if (saida.variables().length) throw new Error("A expressão ainda tem outras variáveis. Informe seus valores na fórmula.");
      if (!Number.isFinite(Number(saida.evaluate().text("decimals")))) throw new Error("A função não está definida nesse valor no domínio real.");
      tipo = "conta";
      passos.push(`Substitua ${v} por ${numero.toString()} na expressão revisada.`);
      aviso = `Valor calculado para ${v} = ${numero.toString()}. Não é uma derivada nem uma raiz da função.`;
    } else if (operacao === "derivar") {
      saida = nerdamer(`diff(${expressao},${v})`);
      tipo = "derivada";
      passos.push(`Derive a expressão em relação a ${v}.`, "Outras letras são tratadas como constantes.");
    } else if (operacao === "integrar") {
      saida = nerdamer(`integrate(${expressao},${v})`);
      tipo = "integral";
      passos.push(`Encontre uma primitiva em relação a ${v}.`, "Acrescente C, a constante de integração.");
      aviso = "Primitiva no domínio da expressão; log representa o logaritmo natural. Restrições de domínio e integrais impróprias exigem análise adicional.";
      // Uma saída log(x) é válida só em x>0 no domínio real; não afirmar validade global.
    } else if (operacao === "definida") {
      // Evita resultados enganosos em singularidades (ex.: integral de 1/x de -1 a 1).
      const funcao = nerdamer(expressao) as ReturnType<typeof nerdamer> & { isPolynomial(): boolean };
      if (!funcao.isPolynomial() || funcao.variables().some((nome: string) => nome !== v)) {
        throw new Error("Integrais definidas rápidas aceitam polinômios de uma variável. Integrais impróprias ou outras funções ainda não são suportadas.");
      }
      if (!inferior?.trim() || !superior?.trim()) throw new Error("Informe os dois limites da integral.");
      const limite = (texto: string) => {
        const expr = validarExpressao(texto);
        if (expr.includes("=")) throw new Error("Use limites numéricos finitos.");
        const valor = nerdamer(expr).evaluate();
        if (valor.variables().length || !Number.isFinite(Number(valor.text("decimals")))) throw new Error("Use limites numéricos finitos.");
        return valor.toString();
      };
      const de = limite(inferior), ate = limite(superior);
      const primitiva = nerdamer(`integrate(${expressao},${v})`);
      saida = nerdamer(`(${primitiva.toString()})`, { [v]: ate }).subtract(nerdamer(primitiva.toString(), { [v]: de }));
      tipo = "integral";
      passos.push(`Primitiva F(${v}) = ${primitiva.toString()}`, `Aplique F(${ate}) − F(${de}).`);
      aviso = "Integral definida de polinômio, calculada pela diferença das primitivas.";
    } else if (operacao === "resolver") {
      if (!new RegExp(`\\b${v}\\b|\\d${v}`).test(expressao)) throw new Error(`A equação não contém ${v}. Escolha a variável que quer isolar.`);
      const partes = expressao.split("=");
      if (partes.some((parte) => !parte.trim())) throw new Error("Complete os dois lados da equação.");
      // Não cancelar denominadores com incógnitas: isso poderia esconder restrições.
      if (/\/\s*(?:[a-zA-Z]|\([^)]*[a-zA-Z])/.test(expressao)) throw new Error("Equações com variáveis no denominador exigem análise de domínio e ainda não são suportadas.");
      saida = nerdamer(`solve(${expressao},${v})`);
      tipo = "equacao";
      if (saida.toString() === "[]") throw new Error("O motor não encontrou soluções. Isso não prova que a equação não tenha solução.");
      passos.push(`Isole ${v}; outras letras são parâmetros.`, "A lista mostra as soluções encontradas pelo motor simbólico.");
      aviso = "As soluções encontradas podem não ser exaustivas em equações transcendentes. Confira as restrições do problema.";
    } else {
      saida = nerdamer(expressao);
      passos.push("Simplifique a expressão preservando as variáveis.");
    }
    const texto = saida.toString();
    if (/integrate\(|diff\(|defint\(|NaN|Infinity|undefined/.test(texto) || texto.length > 1600) {
      throw new Error("O motor não conseguiu obter uma forma fechada dentro deste modo. Nenhum resultado foi inventado.");
    }
    const resultado = operacao === "integrar" ? `${texto} + C` : operacao === "resolver" ? `${v} ∈ ${texto}` : texto;
    passos.push(`Resultado: ${resultado}`);
    return { ok: true, solucao: { expressao: pedido.expressao.trim(), resultado, passos, tipo, aviso } };
  } catch (e) {
    if (e instanceof Error && /division by zero|divide by zero/i.test(e.message)) {
      return { ok: false, motivo: "Divisão por zero: a expressão não está definida nesse valor. Confira o denominador e o domínio." };
    }
    return { ok: false, motivo: e instanceof Error ? e.message : "Não consegui resolver esta expressão." };
  } finally { nerdamer.flush(); }
}
