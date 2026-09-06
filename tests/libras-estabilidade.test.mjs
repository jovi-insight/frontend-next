import assert from "node:assert/strict";
import { test } from "node:test";
import { EstabilizadorLibras, combinarLeituras, consensoNeural, mesmaPose, orientacaoEnquadramento } from "../.teste-build/libras-estabilidade.js";

const leitura = (letter, extra = {}) => ({ status: "confirmado", letter, confidence: 0.85, ...extra });
function repetir(filtro, valor, inicio, duracao, fps = 30) {
  const resultados = [];
  for (let i = 0; i <= Math.floor(duracao / 1000 * fps); i++) {
    resultados.push(filtro.processar(valor, inicio + i * 1000 / fps));
  }
  return resultados;
}
const emitidas = (resultados) => resultados.flatMap((r) => r.registrar ? [r.registrar] : []);
const mao = Array.from({ length: 21 }, (_, i) => ({
  x: 0.4 + i % 5 * 0.025, y: 0.7 - Math.floor(i / 5) * 0.05, z: 0,
}));
mao[9] = { x: 0.45, y: 0.52, z: 0 };
const neural = (letter, capturadoEm = 0) => ({ letter, capturadoEm, confidence: 0.9, pontos: mao });

test("alternância A/S não escreve nem exibe hipóteses como letras confirmadas", () => {
  const filtro = new EstabilizadorLibras();
  for (let i = 0; i < 60; i++) {
    const r = filtro.processar(leitura(i % 2 ? "A" : "S"), i * 50);
    assert.equal(r.registrar, null);
    assert.equal(r.letra, null);
  }
});

test("tremor, incerteza e perda de um quadro não duplicam uma letra", () => {
  const filtro = new EstabilizadorLibras();
  const r = repetir(filtro, leitura("B"), 0, 800);
  r.push(filtro.processar({ status: "incerto" }, 850));
  r.push(...repetir(filtro, leitura("B"), 900, 700));
  r.push(filtro.processar({ status: "sem-mao" }, 1650));
  r.push(...repetir(filtro, leitura("B"), 1700, 700));
  assert.deepEqual(emitidas(r), ["B"]);
});

test("retirar a mão deliberadamente permite soletrar letras repetidas", () => {
  const filtro = new EstabilizadorLibras();
  const r = repetir(filtro, leitura("R"), 0, 800);
  r.push(...repetir(filtro, { status: "sem-mao" }, 850, 500));
  r.push(...repetir(filtro, leitura("R"), 1400, 1000));
  assert.deepEqual(emitidas(r), ["R", "R"]);
});

test("mantém a letra anterior durante um falso candidato e aceita uma troca sustentada", () => {
  const filtro = new EstabilizadorLibras();
  const r = repetir(filtro, leitura("A"), 0, 800);
  const oscilacao = repetir(filtro, leitura("S"), 850, 100);
  assert.ok(oscilacao.every((item) => item.letra === "A"));
  r.push(...oscilacao, ...repetir(filtro, leitura("A"), 1000, 650));
  r.push(...repetir(filtro, leitura("S"), 1700, 1000));
  assert.deepEqual(emitidas(r), ["A", "S"]);
});

test("tempos de confirmação são consistentes em webcams de FPS diferentes", () => {
  for (const fps of [15, 30, 60, 120]) {
    const filtro = new EstabilizadorLibras();
    assert.deepEqual(emitidas(repetir(filtro, leitura("B"), 0, 1200, fps)), ["B"]);
  }
});

test("camada temporal aceita as 24 letras estáticas, incluindo X/Y", () => {
  // Verifica a máquina de estados, não a acurácia do classificador da mão.
  for (const letra of "ABCDEFGHIKLMNOPQRSTUVWXY") {
    assert.deepEqual(emitidas(repetir(new EstabilizadorLibras(), leitura(letra), 0, 1600)), [letra]);
  }
});

test("I não entra antes da trajetória de J; J/Z/Ç não dependem dos votos estáticos", () => {
  const filtro = new EstabilizadorLibras();
  assert.deepEqual(emitidas(repetir(filtro, leitura("I"), 0, 700)), []);
  assert.equal(filtro.processar(leitura("J", { dynamic: true }), 750).registrar, "J");
  assert.equal(filtro.processar(leitura("J", { dynamic: true }), 800).registrar, null);
  for (const letter of ["Z", "Ç"]) {
    assert.equal(new EstabilizadorLibras().processar(leitura(letter, { dynamic: true }), 0).registrar, letter);
  }
});

test("não registra pontuação inválida ou confiança não finita", () => {
  for (const valor of [leitura("A", { confidence: NaN }), leitura("A", { confidence: 0.3 }), leitura("AJ")]) {
    assert.deepEqual(emitidas(repetir(new EstabilizadorLibras(), valor, 0, 1500)), []);
  }
});

test("resposta do servidor precisa corresponder à pose e à captura recentes", () => {
  const local = leitura("B");
  assert.equal(combinarLeituras(local, neural("A"), mao, 700), local);
  assert.equal(combinarLeituras(local, neural("A"), mao, 100).status, "conflito");
  const outra = mao.map((p, i) => i === 8 ? { ...p, y: p.y - 0.15 } : p);
  assert.equal(combinarLeituras(local, neural("A"), outra, 100), local);
  assert.equal(combinarLeituras(leitura("X"), neural("A"), mao, 100).letter, "X");
  assert.equal(combinarLeituras(leitura("Y"), neural("I"), mao, 100).letter, "Y");
  assert.equal(combinarLeituras(leitura("F", { source: "rede-neural-pessoal" }), neural("T"), mao, 100).letter, "F");
});

test("rede não atropela letras em movimento nem o tempo de espera do I", () => {
  const movimento = leitura("J", { dynamic: true });
  assert.equal(combinarLeituras(movimento, neural("I"), mao, 100), movimento);
  const estabilizando = leitura("I", { status: "estabilizando" });
  assert.equal(combinarLeituras(estabilizando, neural("I"), mao, 100).status, "estabilizando");
});

test("consenso neural conta capturas distintas e expira votos antigos", () => {
  assert.equal(consensoNeural([neural("A"), neural("A"), neural("A")], 10), null);
  assert.equal(consensoNeural([neural("A", 0), neural("A", 250), neural("A", 500)], 510)?.letter, "A");
  assert.equal(consensoNeural([neural("A", 0), neural("S", 250), neural("A", 500)], 510), null);
  assert.equal(consensoNeural([neural("A", 0), neural("A", 250), neural("A", 500)], 1200), null);
});

test("compatibilidade tolera deslocamento/escala, mas rejeita outra configuração", () => {
  assert.equal(mesmaPose(mao, mao.map((p) => ({ x: p.x * 1.2 + 0.02, y: p.y * 1.2 - 0.1, z: 0 }))), true);
  assert.equal(mesmaPose(mao, mao.map((p, i) => i === 8 ? { ...p, x: p.x + 0.15 } : p)), false);
  assert.equal(mesmaPose(mao, mao.map((p) => ({ ...p, x: NaN }))), false);
  assert.equal(orientacaoEnquadramento(mao), null);
  assert.match(orientacaoEnquadramento(mao.map((p) => ({ ...p, x: p.x * 0.01, y: p.y * 0.01 }))), /fora do quadro/);
  assert.match(orientacaoEnquadramento(mao.map((p) => ({ x: 0.5 + p.x * 0.05, y: 0.5 + p.y * 0.05, z: 0 }))), /Aproxime/);
});
