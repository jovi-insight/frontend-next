// Notificações/rede simuladas; não envia Web Push a aparelhos reais.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const aviso = { evento_id: 'evento', titulo: 'Prova de teste', tipo: 'prova', data: '2026-09-10', hora: '08:00:00', materia: 'Matemática', minutos_antes: 1440, disparo_em: '2026-09-09T08:00:00-03:00', versao: 'a'.repeat(24) };
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let consumiu = 0, consultas = 0, confirmacoes = 0, viuAntesDeConfirmar = false;
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('jovi_pwa_prompt_dismissed', '1'));
    await context.route('https://backend-rhlz.onrender.com/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/lembretes/consumir')) consumiu++;
      if (url.pathname.endsWith('/lembretes/pendentes')) { consultas++; return route.fulfill({ json: confirmacoes >= 2 ? [] : [aviso] }); }
      if (url.pathname.endsWith('/lembretes/confirmar')) {
        confirmacoes++;
        viuAntesDeConfirmar ||= await page.getByText(/Lembrete: Prova de teste/).isVisible();
        return route.fulfill({ status: confirmacoes === 1 ? 503 : 204 });
      }
      return route.fulfill({ json: url.pathname.includes('/dashboard/biblioteca') ? { itens: [], proximo_cursor: null } : [] });
    });
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:3107') + '/library');
    await page.getByText(/Lembrete: Prova de teste/).waitFor();
    await page.waitForTimeout(400);
    assert.equal(confirmacoes, 1);
    assert.equal(viuAntesDeConfirmar, true, 'primeiro exibe, depois confirma');
    // Observa novas inserções após falha de ACK, sem esperar 60 segundos.
    await page.evaluate(() => {
      window.__novosToasts = 0;
      new MutationObserver(records => { for (const r of records) for (const node of r.addedNodes) if (node.textContent?.includes('Lembrete: Prova de teste')) window.__novosToasts++; }).observe(document.body, { childList: true, subtree: true });
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForTimeout(500);
    assert.equal(confirmacoes, 2); assert.ok(consultas >= 2); assert.equal(consumiu, 0);
    assert.equal(await page.evaluate(() => window.__novosToasts), 0, 'retry de ACK não duplica o aviso');
    console.log('Lembretes: consulta sem consumo, exibição antes do ACK e retry sem toast duplicado OK.');
    await context.close();
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
