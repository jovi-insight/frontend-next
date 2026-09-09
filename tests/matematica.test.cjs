const assert = require('node:assert/strict');
const { resolverMatematica, exibirMultiplicacao, normalizarMultiplicacao } = require('../.teste-build/matematica/matematica.js');
const { resolverAvancada } = require('../.teste-build/matematica/matematica-avancada.js');
const { confirmarLeitura, recorteCamera, diferencaQuadros, diferencaMovimento } = require('../.teste-build/matematica/matematica-leitura.js');
let testes = 0;
for (const [original, visivel] of [['2+3*4', '2+3×4'], ['x*x+X', 'x×x+X'], ['3 * x * 4', '3 × x × 4'], ['2**3', '2**3']]) {
  assert.equal(exibirMultiplicacao(original), visivel);
  assert.equal(normalizarMultiplicacao(visivel), original);
}
function igual(entrada, esperado) {
  const r = resolverMatematica(entrada);
  assert.ok(r.ok, `${entrada}: ${r.motivo}`);
  assert.equal(r.solucao.resultado, esperado, entrada); testes++;
}
for (const [e, r] of [
  ['2+3*4', '14'], ['(2+3)*4', '20'], ['2x + 3 = 11', 'x = 4'],
  ['0,1+0,2', '0,3'], ['1/3+1/6', '0,5'], ['1/3', '1/3'], ['2^3^2', '512'],
  ['-2^2', '-4'], ['(-2)^2', '4'], ['2^-3', '0,125'], ['8÷2', '4'], ['7×8', '56'],
  ['8 x 4', '32'], ['3²+4²', '25'], ['2*(x+3)=14', 'x = 4'],
  ['3x+2=x+10', 'x = 4'], ['x/3=2', 'x = 6'], ['x=x', 'Infinitas soluções'],
  ['x=x+1', 'Sem solução'], ['2+2=4', 'Igualdade verdadeira'], ['2+2=5', 'Igualdade falsa'],
  ['2+2=', '4'], ['8 + 7 = ?', '15'], ['8 ÷ 2 * (2 + 2) = ?', '16'], ['8 / (2 * (2 + 2)) = ?', '1'], ['0.0000001*x=1', 'x = 10000000'],
]) igual(e, r);
for (const entrada of ['1/0', '0^0', '2+', '1 2+3', '2+3\n4+5', 'alert(1)', 'x/0=1', 'x*x=4', '1/(x-1)=2', '1e3+2', '99^99', '2,3,4+1', '2+3 texto', '=2', '2=3=4']) {
  assert.equal(resolverMatematica(entrada).ok, false, entrada); testes++;
}
for (let a = -15; a <= 15; a++) for (let b = -4; b <= 4; b++) igual(`(${a})*(${b})+3`, String(a * b + 3));
const avancado = (expressao, operacao = 'auto', extra = {}) => resolverAvancada({ expressao, operacao, variavel: 'x', ...extra });
for (const [e, op, r, extra] of [
  ['x^3+sin(x)', 'derivar', '3*x^2+cos(x)'], ['x^2', 'integrar', '(1/3)*x^3 + C'],
  ['cos(x)', 'integrar', 'sin(x) + C'], ['x^2', 'definida', '1/3', { inferior: '0', superior: '1' }],
  ['x^2', 'definida', '-1/3', { inferior: '1', superior: '0' }],
  ['x^2-5*x+6=0', 'resolver', 'x ∈ [2,3]'], ['F=m*a', 'resolver', 'a ∈ [F*m^(-1)]', { variavel: 'a' }],
  ['x^2+2*x+x^2', 'simplificar', '2*x+2*x^2'], ['d/dx(x^3)', 'auto', '3*x^2'], ['f(x)=x^3', 'derivar', '3*x^2'],
  ['2x+3', 'simplificar', '2*x+3'], ['sin(pi/2)', 'auto', '1'], ['sqrt(2)', 'auto', 'sqrt(2)'],
  ['f(x)=(x^3+6*x^2-3)/(x+4)', 'avaliar', '-3/4', { valor: '0' }],
  ['(x^3+6*x^2-3)/(x+4)', 'avaliar', '29/6', { valor: '2' }],
]) {
  const resposta = avancado(e, op, extra);
  assert.ok(resposta.ok, `${e}: ${resposta.motivo}`); assert.equal(resposta.solucao.resultado, r, e); testes++;
}
for (const pedido of [
  ['1/x', 'definida', { inferior: '-1', superior: '1' }], ['x^2', 'definida', { inferior: '', superior: '1' }],
  ['diff(x,x)', 'auto'], ['set(foo,3)', 'auto'], ['x;fetch(1)', 'auto'], ['x^9999', 'auto'],
  ['x'.repeat(300), 'auto'], ['2+3\n4+5', 'auto'], ['1 2+3', 'auto'], ['1/x=3', 'resolver'], ['x2+3', 'auto'], ['42', 'auto'],
  ['f(x)=(x^3+6*x^2-3)/(x+4)', 'auto'], ['x^2+3', 'auto'], ['2x+3', 'auto'],
  ['(x^3+6*x^2-3)/(x+4)', 'avaliar', { valor: '-4' }],
  ['x^2', 'avaliar', { valor: '' }], ['x^2', 'avaliar', { valor: 'x' }],
  ['x^2', 'avaliar', { valor: '1/0' }], ['x+y', 'avaliar', { valor: '2' }],
]) { assert.equal(avancado(...pedido).ok, false, String(pedido)); testes++; }
// Fração relatada: verificar o cálculo, não exigir a mesma ordenação textual.
const fracao = '(x^3+6*x^2-3)/(x+4)';
const derivadaFracao = avancado(fracao, 'derivar');
assert.ok(derivadaFracao.ok);
assert.equal(derivadaFracao.solucao.tipo, 'derivada');
const nerdamer = require('nerdamer/all.js');
for (const x of [-10, -5, -3, -1, 0, 1, 2, 10]) {
  const atual = Number(nerdamer(derivadaFracao.solucao.resultado, { x }).evaluate().text('decimals'));
  const esperado = (2*x**3+18*x**2+48*x+3)/(x+4)**2;
  assert.ok(Math.abs(atual-esperado) < 1e-9, `derivada da fração em ${x}`); testes++;
}
nerdamer.flush();
let consenso = confirmarLeitura(null, '2+2', 80, 0);
assert.equal(consenso.confirmado, false);
assert.equal(confirmarLeitura(consenso.candidato, '2+2', 80, 200).confirmado, true);
assert.equal(confirmarLeitura(consenso.candidato, '2+3', 80, 200).confirmado, false);
assert.equal(confirmarLeitura(consenso.candidato, '2+2', 30, 200).confirmado, false);
assert.equal(confirmarLeitura(consenso.candidato, '2+2', 80, 6000).confirmado, false);
assert.equal(confirmarLeitura(consenso.candidato, '2+2', NaN, 200).confirmado, false);
let medio = confirmarLeitura(null, '2+2', 57, 0);
medio = confirmarLeitura(medio.candidato, '2+2', 57, 200);
assert.equal(medio.confirmado, false);
assert.equal(confirmarLeitura(medio.candidato, '2+2', 57, 400).confirmado, true);
assert.deepEqual(recorteCamera({ width: 1920, height: 1080 }, { width: 390, height: 780 }, { x: 0, y: 0, width: 390, height: 780 }), { x: 690, y: 0, width: 540, height: 1080 });
assert.deepEqual(recorteCamera({ width: 1000, height: 1000 }, { width: 500, height: 500 }, { x: 200, y: 200, width: 100, height: 100 }, 2), { x: 450, y: 450, width: 100, height: 100 });
assert.equal(diferencaQuadros(new Uint8Array([0,255]), new Uint8Array([0,255])), 0);
assert.equal(diferencaQuadros(null, new Uint8Array([0])), 1);
const antigo = new Uint8Array(2000).fill(255), novo = antigo.slice(); novo[100] = 0; novo[101] = 0;
assert.ok(diferencaQuadros(antigo, novo) > 0.025, 'mudança localizada não desaparece na média');
let lento = confirmarLeitura(null, '8+7', 65, 0);
lento = confirmarLeitura(lento.candidato, '8+7', 65, 2300);
assert.equal(confirmarLeitura(lento.candidato, '8+7', 65, 4600).confirmado, true, 'leitor lento não reinicia o consenso para sempre');
for (const resolver of [resolverMatematica, avancado]) {
  const r = resolver('8 ÷ 2(2 + 2) = ?');
  assert.equal(r.ok, false);
  assert.equal(r.revisao.alternativas.length, 2);
  assert.equal(resolverMatematica(r.revisao.alternativas[0].expressao).solucao.resultado, '16');
  assert.equal(resolverMatematica(r.revisao.alternativas[1].expressao).solucao.resultado, '1');
}
assert.equal(resolverMatematica('8 ? + 7').ok, false, 'não apagar interrogações de símbolos ilegíveis');
const parado = new Uint8Array(96 * 24).fill(220), tremor = new Uint8Array(96 * 24).fill(228);
for (let y = 8; y < 18; y++) for (let x = 20; x < 65; x += 7) {
  parado[y * 96 + x] = 20; tremor[(y + 1) * 96 + x + 1] = 28;
}
assert.ok(diferencaQuadros(parado, tremor) > .025, 'o gate antigo reiniciava com tremor pequeno');
assert.ok(diferencaMovimento(parado, tremor) < .01, 'compensa tremor e exposição uniformes');
assert.ok(diferencaMovimento(parado, new Uint8Array(96 * 24).fill(220)) > .065, 'retirar a expressão é troca de cena');
console.log(`Matemática: ${testes} cálculos/casos inválidos + consenso e recorte OK.`);
