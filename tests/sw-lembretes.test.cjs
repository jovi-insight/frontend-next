const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const eventos = {}, exibidos = [];
const self = { addEventListener: (nome, fn) => { eventos[nome] = fn; },
  location: { origin: 'https://insight.test' }, registration: { showNotification: async (titulo, opcoes) => exibidos.push({ titulo, ...opcoes }) } };
vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), { self, URL, Set, Promise, String, Date, Headers, Response });
(async () => {
  let fim;
  eventos.push({ data: { json: () => ({ titulo: 'Prova amanhã', corpo: 'Matemática', tag: 'prova-1', url: '/calendar/prova-1' }) }, waitUntil: p => { fim = p; } });
  await fim;
  assert.equal(exibidos[0].titulo, 'Prova amanhã');
  assert.equal(exibidos[0].data.url, '/calendar/prova-1');
  eventos.push({ data: { json: () => { throw new Error('JSON inválido'); } }, waitUntil: p => { fim = p; } });
  await fim;
  assert.equal(exibidos[1].titulo, 'Lembrete do INSIGHT');
  console.log('Service worker exibe push sem página aberta e suporta payload vazio (simulado).');
})().catch(e => { console.error(e); process.exitCode = 1; });
