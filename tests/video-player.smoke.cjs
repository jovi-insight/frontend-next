// Vídeo sintético + API simulada: não acessa nem modifica vídeos reais.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:3107';
const remoteId = '20fcefb4-8bb8-4b3f-8d8a-a72fdbac9835';

async function local(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const pedido = indexedDB.open('jovi-media-library', 1);
    pedido.onsuccess = () => { const db = pedido.result, tx = db.transaction('media'); const q = tx.objectStore('media').get('vid-teste');
      tx.oncomplete = () => { db.close(); const v = q.result; resolve({ size: v.blob.size, text: v.transcription?.text, remoteId: v.remoteId, envioId: v.envioId, state: v.syncStatus }); };
      tx.onerror = () => reject(tx.error);
    };
  }));
}

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-video-smoke-'));
  const clip = path.join(temp, 'teste.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=160x120:d=1.3', '-c:v', 'libvpx-vp9', '-an', '-y', clip]);
  const bytes = fs.readFileSync(clip);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [], ids = [];
      let mode = 'validation', uploads = 0, patches = 0, transcriptions = 0;
      let saved = null;
      page.on('pageerror', e => errors.push(e.message));
      await context.addInitScript(() => localStorage.setItem('jovi_pwa_prompt_dismissed', '1'));
      await context.route('https://backend-rhlz.onrender.com/**', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname === '/v1/media/transcribe') {
          transcriptions++;
          const form = await new Response(req.postDataBuffer(), { headers: { 'Content-Type': req.headers()['content-type'] } }).formData();
          assert.equal(form.get('media').type, 'video/mp4');
          assert.deepEqual(Buffer.from(await form.get('media').arrayBuffer()), bytes);
          if (mode === 'validation') return route.fulfill({ status: 422, json: { detail: [{ loc: ['body', 'media'], type: 'missing', msg: 'Field required' }] } });
          if (mode === 'quota') return route.fulfill({ status: 429, json: { detail: 'Limite de transcrição atingido.' } });
          if (mode === 'empty') return route.fulfill({ json: { text: '', segments: [] } });
          if (mode === 'slow') { await new Promise(r => setTimeout(r, 1800)); }
          return route.fulfill({ json: { text: 'Teste de aula preservada.', language: 'pt-BR', segments: [{ start: 0, end: 0.2, text: 'Teste de aula preservada.' }] } });
        }
        if (url.pathname === '/videos' && req.method() === 'POST') {
          uploads++;
          const form = await new Response(req.postDataBuffer(), { headers: { 'Content-Type': req.headers()['content-type'] } }).formData();
          assert.deepEqual(Buffer.from(await form.get('arquivo').arrayBuffer()), bytes);
          ids.push(form.get('envio_id'));
          saved = { id: remoteId, nome: 'teste.mp4', mime_type: 'video/mp4', tamanho: bytes.length, duracao: 1.3, url_storage: 'https://storage.test/teste.mp4', criado_em: new Date().toISOString(), transcricao: null, resumo: null };
          if (uploads === 1) return route.abort('failed'); // simula resposta perdida após o servidor aceitar
          return route.fulfill({ status: 201, json: saved });
        }
        if (url.pathname === '/videos/' + remoteId && req.method() === 'PATCH') {
          patches++;
          if (patches === 1) return route.fulfill({ status: 503, json: { detail: 'Banco temporariamente indisponível.' } });
          saved = { ...saved, ...req.postDataJSON() };
          return route.fulfill({ json: saved });
        }
        if (url.pathname === '/videos' && req.method() === 'GET') return route.fulfill({ json: saved ? [saved] : [] });
        return route.fulfill({ json: url.pathname === '/dashboard/biblioteca' ? { itens: [], proximo_cursor: null } : [] });
      });
      await page.goto(base + '/library');
      await page.evaluate(async b64 => {
        const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'video/mp4;codecs=vp09' });
        await new Promise((resolve, reject) => {
          const pedido = indexedDB.open('jovi-media-library', 1);
          pedido.onupgradeneeded = () => pedido.result.createObjectStore('media', { keyPath: 'id' });
          pedido.onsuccess = () => { const db = pedido.result, tx = db.transaction('media', 'readwrite');
            tx.objectStore('media').put({ id: 'vid-teste', name: 'teste:22:37.mp4', type: blob.type, size: blob.size, duration: 1.3, createdAt: new Date().toISOString(), blob, transcription: null, syncStatus: 'pendente', syncError: 'Envio anterior falhou.' });
            tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
          };
        });
      }, bytes.toString('base64'));
      await page.goto(base + '/player/vid-teste');
      await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1);
      await page.locator('video').evaluate(async video => { await video.play(); video.pause(); });
      const button = page.getByRole('button', { name: 'Transcrever com IA' });
      await button.click();
      await page.getByRole('alert').filter({ hasText: 'campo obrigatório “media”' }).waitFor();
      assert.equal((await local(page)).size, bytes.length);
      assert.equal((await local(page)).text, undefined);
      assert.equal(await page.getByRole('link', { name: 'Baixar vídeo' }).count(), 1);
      mode = 'quota'; await button.click(); await page.getByRole('alert').filter({ hasText: 'HTTP 429' }).waitFor();
      mode = 'empty'; await button.click(); await page.getByRole('alert').filter({ hasText: 'Não foi identificada fala' }).waitFor();
      assert.equal((await local(page)).text, undefined);
      mode = 'slow'; await button.click(); await page.getByRole('button', { name: 'Cancelar transcrição' }).click();
      await page.getByRole('alert').filter({ hasText: 'cancelada' }).waitFor();
      await page.waitForTimeout(1900); assert.equal((await local(page)).text, undefined);
      mode = 'ok'; await button.click();
      await page.getByText('Sem conexão com o servidor.', { exact: false }).waitFor();
      assert.equal((await local(page)).text, 'Teste de aula preservada.');
      const retry = page.getByRole('button', { name: 'Tentar sincronizar' });
      await retry.click(); await page.getByText('Banco temporariamente indisponível.', { exact: false }).waitFor();
      assert.equal((await local(page)).remoteId, remoteId);
      await retry.click(); await page.getByText('Banco + offline', { exact: true }).waitFor();
      assert.equal(uploads, 2, 'falha no PATCH não gera terceiro upload');
      assert.equal(ids[0], ids[1], 'retry usa a mesma chave após resposta perdida');
      assert.ok(ids[0]); assert.equal(patches, 2);
      await page.reload(); await page.getByText('Banco + offline', { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1);
      await page.locator('video').evaluate(async video => { await video.play(); video.pause(); });
      assert.equal((await local(page)).text, 'Teste de aula preservada.');
      assert.equal((await local(page)).size, bytes.length);
      assert.equal(transcriptions, 5);
      assert.deepEqual(errors, []);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => scrollTo(0, 0));
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `video-${width}.png`), fullPage: true });
      const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => ({ tag: el.tagName, cls: el.className, width: el.getBoundingClientRect().width, text: el.textContent?.slice(0, 65) })));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(overflow));
      console.log(`${width}px: 422/429, silêncio, cancelamento, bytes preservados, retry de upload/PATCH e reabertura OK (API simulada).`);
      await context.close();
    }
  } finally { await browser.close(); fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
