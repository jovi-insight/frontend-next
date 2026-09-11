// OPT-IN. IA real, vídeo sintético. Até 1 transcrição + 1 resolução por execução.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');

async function main() {
  if (process.env.MATH_TEST_REAL_API !== '1') throw new Error('Confirme o consumo da IA real com MATH_TEST_REAL_API=1.');
  const fracao = process.env.MATH_TEST_IA_CASO === 'fracao';
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const chamadas = { leitura: 0, resolucao: 0 };
    await context.route('https://backend-rhlz.onrender.com/**', async route => {
      const req = route.request();
      if (req.url().includes('/matematica/')) {
        const tipo = req.url().endsWith('/resolver') ? 'resolucao' : 'leitura';
        if (req.method() === 'POST' && ++chamadas[tipo] > 1) return route.abort();
        return route.continue();
      }
      return route.fulfill({ json: [] });
    });
    const page = await context.newPage(), erros = [], ocr = [];
    page.on('requestfailed', req => { if (req.url().includes('/matematica/')) console.log('Falha de rede:', new URL(req.url()).pathname, req.failure()?.errorText); });
    page.on('pageerror', erro => erros.push(erro.message));
    page.on('request', req => { if (/tesseract|math-ocr|traineddata/.test(req.url())) ocr.push(req.url()); });
    await page.addInitScript(fracao => {
      localStorage.setItem('jovi_pwa_prompt_dismissed', '1');
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
        const ctx = canvas.getContext('2d');
        const pintar = () => {
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1280, 720);
          const frame = document.querySelector('.math-frame')?.getBoundingClientRect(), video = document.querySelector('.camera-video')?.getBoundingClientRect();
          if (frame && video) {
            const escala = Math.max(video.width / 1280, video.height / 720);
            const x = (frame.x + frame.width / 2 - video.x - video.width / 2) / escala + 640;
            const y = (frame.y + frame.height / 2 - video.y - video.height / 2) / escala + 360;
            ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if (fracao) {
              ctx.font = 'italic 25px Times New Roman'; ctx.fillText('f(x) =', x - 100, y);
              ctx.fillText('x³ + 6x² − 3', x + 28, y - 19); ctx.fillText('x + 4', x + 28, y + 20);
              ctx.fillRect(x - 42, y, 140, 1.5);
            } else { ctx.font = '32px Arial'; ctx.fillText('2 + 3 × 4', x, y); }
          }
          requestAnimationFrame(pintar);
        };
        pintar(); return canvas.captureStream(15);
      };
    }, fracao);
    await page.goto(process.env.MATH_TEST_URL || 'https://frontend-next-topaz-mu.vercel.app', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Matemática', exact: true }).click();
    await page.waitForTimeout(500); assert.deepEqual(chamadas, { leitura: 0, resolucao: 0 });
    const lida = page.waitForResponse(r => r.url().endsWith('/ler-formula') && r.request().method() === 'POST', { timeout: 25000 });
    const inicio = performance.now();
    await page.getByRole('button', { name: 'Fotografar e ler com IA' }).click();
    const leitura = await lida, dados = await leitura.json();
    assert.equal(leitura.status(), 200, JSON.stringify(dados));
    console.log(`Transcrição real: ${Math.round(performance.now() - inicio)} ms; ${JSON.stringify(dados)}`);
    const normalizar = texto => texto.replace(/\s/g, '').replace(/×/g, '*').replace(/(\d)([a-z])/g, '$1*$2');
    assert.equal(normalizar(dados.expressao), fracao ? '(x^3+6*x^2-3)/(x+4)' : '2+3*4');
    await page.locator('.math-note').filter({ hasText: 'Leitura da IA' }).waitFor();
    assert.equal(chamadas.resolucao, 0);
    if (fracao) {
      await page.getByLabel('Operação matemática').selectOption('avaliar');
      await page.getByLabel('Valor da variável').fill('0');
    }
    const resolvida = page.waitForResponse(r => r.url().endsWith('/resolver') && r.request().method() === 'POST', { timeout: 50000 });
    const inicioResolucao = performance.now();
    await page.getByRole('button', { name: 'Resolver com IA · passo a passo' }).click();
    const resposta = await resolvida, resultado = await resposta.json();
    assert.equal(resposta.status(), 200, JSON.stringify(resultado));
    console.log(`Resolução real: ${Math.round(performance.now() - inicioResolucao)} ms; ${JSON.stringify(resultado)}`);
    assert.equal(resultado.status, 'resolvido'); assert.ok(resultado.passos.length >= 2);
    const texto = resultado.resultado.replace(/\s/g, '').replace(/−/g, '-');
    assert.match(texto, fracao ? /-3\/4|-0[.,]75/ : /(?<!\d)14(?![\d.,])/);
    await page.getByLabel('Resultado matemático').waitFor();
    await page.getByLabel('Resultado matemático').locator('.katex').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.getByLabel('Passo a passo da resolução').locator('li').count(), resultado.passos.length);
    if (process.env.MATH_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MATH_SCREENSHOT_DIR}/matematica-ia-real-${fracao ? 'fracao' : 'conta'}.png`, fullPage: true });
    assert.deepEqual(chamadas, { leitura: 1, resolucao: 1 }); assert.deepEqual(erros, []); assert.deepEqual(ocr, []);
    console.log('Foto → transcrição real → revisão → resolução real com passos: OK (vídeo sintético).');
  } finally { await browser.close(); }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
