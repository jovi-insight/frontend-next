import assert from "node:assert";
import { pontosDeEstudo, termosChave } from "../.teste-build/estudo.js";

const TEXTO =
  "A fotossíntese converte energia luminosa em energia química nas plantas. " +
  "A clorofila absorve a luz solar dentro dos cloroplastos. " +
  "Curto. " +
  "O processo libera oxigênio e produz glicose para a planta.";

// Frases curtas demais não viram ponto de estudo — "Curto." seria ruído.
{
  const pontos = pontosDeEstudo(TEXTO);
  assert.strictEqual(pontos.length, 3);
  assert.ok(pontos[0].startsWith("A fotossíntese"));
  assert.ok(!pontos.some((p) => p === "Curto"));
}

// Respeita o limite pedido.
assert.strictEqual(pontosDeEstudo(TEXTO, 2).length, 2);

// Termo mais repetido vem primeiro; palavras de ligação ficam de fora.
{
  const termos = termosChave(TEXTO, 4);
  assert.strictEqual(termos[0], "Energia");
  assert.ok(!termos.some((t) => t.toLowerCase() === "para"));
  // Capitalizado para virar chip na tela.
  assert.ok(termos.every((t) => t[0] === t[0].toUpperCase()));
}

// Texto vazio não pode explodir: documento sem OCR chega assim.
assert.deepStrictEqual(pontosDeEstudo(""), []);
assert.deepStrictEqual(termosChave(""), []);

console.log("estudo.test.mjs OK");
