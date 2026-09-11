const assert = require('node:assert/strict');
const katex = require('katex');
const { formulaParaLatex: formatar } = require('../.teste-build/matematica/matematica-formatacao.js');
const casos = [
  ['(x^3+6*x^2-3)/(x+4)', /\\frac\{.*x.*\}\{.*x \+ 4/],
  ['f(x)=(x^3+6*x^2-3)/(x+4)', /^f/],
  ['-3/4', /\\frac\{-3\}\{4\}/],
  ['3*x^2', /3\\times \{x\}\^\{2\}/],
  ['x^3/3+C', /\\frac.* \+ C/],
  ['sqrt(x^2+1)', /^\\sqrt/],
  ['2+3*4', /2 \+ 3\\times 4/],
  ['X*x', /X\\times x/],
  ['1/2/3', /\\frac\{\\frac\{1\}\{2\}\}\{3\}/],
  ['sin(x)+cos(x)', /\\sin.*\\cos/],
  ['x²+6x³', /\^\{2\}.*\^\{3\}/],
  ['2**3', /\{2\}\^\{3\}/],
  ['-x^2', /^-\{x\}\^\{2\}$/],
  ['(-x)^2', /\\left\(-x\\right\)/],
  ['x=1/2', /^x = \\frac/],
  ['2,5+1', /2\{,\}5/],
  [String.raw`\int_0^1 x^2\,dx=\frac{1}{3}`, /\\int/],
];
for (const [entrada, esperado] of casos) {
  const latex = formatar(entrada); assert.match(latex, esperado, entrada);
  assert.match(katex.renderToString(latex, { throwOnError: true, trust: false }), /katex/);
}
for (const entrada of ['', '8/2(2+2)', 'x+(', 'resposta desconhecida', '<img src=x>', '('.repeat(50)+'x'+')'.repeat(50)]) {
  assert.equal(formatar(entrada), null, entrada);
}
console.log('23 verificações: frações, expoentes, raízes, integrais, preservação de agrupamento e fallback.');
