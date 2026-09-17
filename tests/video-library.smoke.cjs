// IndexedDB e locks reais no navegador; servidor simulado, sem dados reais.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('https://backend-rhlz.onrender.com/**', r => r.fulfill({ json: [] }));
    const page = await context.newPage();
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:3107') + '/library');
    const code = ts.transpileModule(fs.readFileSync('lib/video-library.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    await page.evaluate(() => {
      window.__calls = { uploads: 0, patches: 0 }; window.__saved = []; window.__failPatch = true;
      window.__api = {
        isUuid: v => /^[0-9a-f-]{36}$/.test(v),
        enviarVideoUsuario: async (file, duration, id) => {
          window.__calls.uploads++;
          window.__saved.push({ id, nome: file.name, tamanho: file.size, duracao: duration, mime_type: file.type, criado_em: new Date().toISOString(), url_storage: 'https://fake/video.mp4', transcricao: null, resumo: null });
          throw new Error('Resposta perdida após aceitar arquivo');
        },
        listarVideosUsuario: async () => structuredClone(window.__saved),
        atualizarVideoUsuario: async (id, data) => {
          window.__calls.patches++;
          await new Promise(r => setTimeout(r, 20));
          if (window.__failPatch) throw new Error('PATCH indisponível');
          const saved = window.__saved.find(v => v.id === id); Object.assign(saved, data); return saved;
        },
      };
    });
    await page.addScriptTag({ content: `(function(){const exports={};const require=()=>window.__api;${code}\nwindow.__library=exports;})();` });
    const result = await page.evaluate(async () => {
      const l = window.__library;
      const original = new File(['bytes-preservados'], 'aula.mp4', { type: 'video/mp4' });
      const item = await l.adicionarVideo(original, 1);
      const afterUpload = { pending: item.syncStatus, id: item.envioId, bytes: await item.blob.text() };
      const listed = await l.listarVideos(); // resposta perdida não cria segunda cópia na galeria
      const countAfterList = listed.length;
      await l.salvarTranscricao(item.id, { text: 'Transcrição ainda local', segments: [] });
      const afterFailedPatch = await l.listarVideos(); // remoto sem transcrição não sobrescreve a local
      const preserved = afterFailedPatch[0].transcription.text;
      window.__failPatch = false;
      await Promise.all([l.sincronizarVideo(item.id), l.salvarTranscricao(item.id, { text: 'Transcrição final', segments: [] }), l.sincronizarVideo(item.id)]);
      const final = await l.obterVideo(item.id);
      return { afterUpload, countAfterList, preserved, finalText: final.transcription.text,
        finalRemote: window.__saved[0].transcricao.text, state: final.syncStatus, calls: window.__calls, bytes: await final.blob.text() };
    });
    assert.equal(result.afterUpload.pending, 'pendente'); assert.ok(result.afterUpload.id);
    assert.equal(result.countAfterList, 1);
    assert.equal(result.preserved, 'Transcrição ainda local');
    assert.equal(result.finalText, 'Transcrição final'); assert.equal(result.finalRemote, 'Transcrição final');
    assert.equal(result.state, 'sincronizado'); assert.equal(result.calls.uploads, 1);
    assert.equal(result.bytes, 'bytes-preservados');
    const aborted = await page.evaluate(async () => {
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function(...args) {
        const req = add.apply(this, args), tx = this.transaction;
        req.addEventListener('success', () => tx.abort());
        return req;
      };
      try { await window.__library.adicionarVideo(new File(['x'], 'a.mp4', { type: 'video/mp4' })); return false; }
      catch { return true; }
      finally { IDBObjectStore.prototype.add = add; }
    });
    assert.equal(aborted, true, 'não confirma um salvamento abortado após sucesso do pedido');
    console.log('IndexedDB: commit/abort, resposta perdida sem duplicação, listagem preserva alterações locais e sincronizações concorrentes OK.');
    await context.close();
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
