// Rede simulada; não acessa nem altera fotos reais.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBz8AAAAASUVORK5CYII=', 'base64');
const fotos = Array.from({ length: 55 }, (_, i) => ({ id: String(i), pasta_id: 'pasta', materia: i % 2 ? 'Física' : 'Matemática', ultima_atualizacao: '2026-09-09T10:00:00Z', imagem_url: 'https://storage.test/original-' + i + '.jpg', miniatura_url: '/conteudo/' + i + '/miniatura', paginas: 2, resumo_pronto: true }));
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const consultas = [], originais = [], erros = [];
      let falhar = false, removidos = new Set();
      await context.route('https://storage.test/**', route => { originais.push(route.request().url()); return route.fulfill({ contentType: 'image/png', body: png }); });
      await context.route('https://backend-rhlz.onrender.com/**', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.endsWith('/miniatura')) return route.fulfill({ contentType: 'image/png', body: png, headers: { 'Access-Control-Allow-Origin': '*' } });
        if (req.method() === 'DELETE') { removidos.add(url.pathname.split('/').pop()); return route.fulfill({ status: 204 }); }
        consultas.push(url.pathname);
        if (url.pathname === '/dashboard/biblioteca') {
          if (falhar) { falhar = false; return route.fulfill({ status: 503, json: { detail: 'Teste de falha' } }); }
          const lixo = url.searchParams.get('lixeira') === 'true', inicio = Number(url.searchParams.get('cursor') || 0);
          const itens = fotos.filter(f => lixo ? removidos.has(f.id) : !removidos.has(f.id));
          return route.fulfill({ json: { itens: itens.slice(inicio, inicio + 24), proximo_cursor: inicio + 24 < itens.length ? String(inicio + 24) : null } });
        }
        return route.fulfill({ json: [] });
      });
      const page = await context.newPage(); page.on('pageerror', e => erros.push(e.message));
      await page.addInitScript(() => localStorage.setItem('jovi_pwa_prompt_dismissed', '1'));
      await page.goto((process.env.TEST_URL || 'http://127.0.0.1:3107') + '/library');
      await page.locator('a.album-item').nth(23).waitFor();
      assert.equal(await page.locator('a.album-item').count(), 24);
      await page.locator('a.album-item img.is-loaded').first().waitFor();
      assert.equal(consultas.filter(p => p === '/dashboard/biblioteca').length, 1);
      assert.ok(!consultas.some(p => /pastas|materias|recentes|videos|lixeira/.test(p)));
      assert.deepEqual(originais, []);
      falhar = true;
      await page.getByRole('button', { name: 'Carregar mais fotos' }).click();
      await page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' }).waitFor();
      assert.equal(await page.locator('a.album-item').count(), 24, 'erro não apaga páginas anteriores');
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      await page.locator('a.album-item').nth(47).waitFor();
      await page.getByRole('button', { name: 'Carregar mais fotos' }).click();
      await page.locator('a.album-item').nth(54).waitFor();
      assert.equal(await page.locator('a.album-item').count(), 55);
      assert.equal(await page.getByRole('button', { name: 'Carregar mais fotos' }).count(), 0);
      assert.equal(new Set(await page.locator('a.album-item').evaluateAll(els => els.map(el => el.href))).size, 55);
      await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
      await page.locator('button.album-item').first().click();
      await page.getByRole('button', { name: 'Mover para lixeira (1)' }).click();
      await page.locator('a.album-item').nth(53).waitFor();
      assert.equal(removidos.size, 1);
      await page.getByRole('button', { name: 'Lixeira', exact: true }).click();
      await page.locator('a.album-item').waitFor();
      assert.equal(await page.locator('a.album-item').count(), 1);
      await page.getByRole('button', { name: 'Voltar às fotos' }).click();
      await page.locator('a.album-item').nth(53).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(erros, []);
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: process.env.SCREENSHOT_DIR + '/biblioteca-' + width + '.png', fullPage: true });
      console.log(width + 'px: paginação, miniaturas, sem downloads originais, retry, seleção e lixeira OK.');
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
