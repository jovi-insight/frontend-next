// OCR REAL sobre vídeo sintético. Não mede acurácia com cadernos/pessoas reais.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const { spawn } = require('node:child_process');

async function main() {
  const servidor = process.env.MATH_TEST_SERVER ? spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3107'], { stdio: 'pipe' }) : null;
  if (servidor) await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor de teste não iniciou.')), 15000);
    servidor.stdout.on('data', chunk => { if (chunk.toString().includes('Ready')) { clearTimeout(timer); resolve(); } });
    servidor.on('exit', code => { clearTimeout(timer); reject(new Error(`Servidor encerrou: ${code}`)); });
  });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      let leiturasIA = 0;
      let fotoEnviadaIA = null;
      await context.route('https://backend-rhlz.onrender.com/**', async route => {
        const formula = route.request().url().includes('/matematica/ler-formula');
        if (formula && route.request().method() === 'POST') {
          leiturasIA++;
          const form = await new Response(route.request().postDataBuffer(), { headers: { 'Content-Type': route.request().headers()['content-type'] } }).formData();
          const foto = [...form.values()].find(valor => typeof valor !== 'string');
          assert.ok(foto, 'requisição contém a foto');
          fotoEnviadaIA = Buffer.from(await foto.arrayBuffer()).toString('base64');
        }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(formula ? {
          expressao: 'x^2', operacao: 'integrar', variavel: 'x', inferior: null, superior: null, confianca: 'alta', observacao: null,
        } : []) });
      });
      await page.addInitScript(() => {
        localStorage.setItem('jovi_pwa_prompt_dismissed', '1');
        window.__mathScene = { text: '2 + 3 × 4', blank: false, dark: false, jitter: 0 };
        const OriginalWorker = window.Worker;
        window.Worker = class extends OriginalWorker {
          constructor(...args) { super(...args); this.addEventListener('message', e => {
            if (e.data.action === 'recognize' && e.data.status === 'resolve') window.__mathOcr = e.data.data;
          }); }
        };
        navigator.mediaDevices.getUserMedia = async () => {
          const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
          const ctx = c.getContext('2d');
          const paint = () => {
            ctx.fillStyle = window.__mathScene.dark ? '#192724' : '#fafafa'; ctx.fillRect(0, 0, c.width, c.height);
            const frame = document.querySelector('.math-frame')?.getBoundingClientRect();
            const video = document.querySelector('.camera-video')?.getBoundingClientRect();
            if (frame && video && !window.__mathScene.blank) {
              const scale = Math.max(video.width / c.width, video.height / c.height);
              const x = (frame.x + frame.width / 2 - video.x - video.width / 2) / scale + c.width / 2;
              const y = (frame.y + frame.height / 2 - video.y - video.height / 2) / scale + c.height / 2;
              ctx.fillStyle = window.__mathScene.dark ? '#f5f5f5' : '#101010'; ctx.font = '32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              const j = window.__mathScene.jitter;
              ctx.fillText(window.__mathScene.text, x + Math.sin(performance.now() / 190) * j, y + Math.cos(performance.now() / 160) * j);
            }
            requestAnimationFrame(paint);
          };
          paint(); return c.captureStream(15);
        };
      });
      await page.goto(process.env.MATH_TEST_URL || 'http://127.0.0.1:3107', { waitUntil: 'domcontentloaded' });
      const inicio = performance.now();
      await page.getByRole('button', { name: 'Matemática', exact: true }).click();
      const resultado = page.getByLabel('Resultado matemático');
      await resultado.filter({ hasText: /^14$/ }).waitFor({ timeout: 40000 }).catch(async e => {
        console.log('Estado da câmera:', await page.locator('.math-live').innerText(), errors,
          await page.evaluate(() => window.__mathOcr && { text: window.__mathOcr.text, confidence: window.__mathOcr.confidence }));
        if (process.env.MATH_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MATH_SCREENSHOT_DIR}/falha-${width}.png` });
        throw e;
      });
      console.log(`${width}px, OCR real + preparo inicial: ${Math.round(performance.now() - inicio)} ms; ${await page.locator('.math-answer small').innerText()}`);
      assert.equal(leiturasIA, 0, 'modo ao vivo não envia fotos para a API');
      const inicioQuente = performance.now();
      await page.evaluate(() => { window.__mathScene.text = '8 + 7'; });
      await resultado.filter({ hasText: /^15$/ }).waitFor({ timeout: 15000 });
      console.log(`${width}px, nova expressão, motor aquecido: ${Math.round(performance.now() - inicioQuente)} ms`);
      const metrica = await page.locator('.math-answer small').innerText();
      await page.waitForTimeout(2400);
      assert.equal(await resultado.innerText(), '15');
      assert.equal(await page.locator('.math-answer small').innerText(), metrica, 'releituras não inflam a duração');
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      await page.evaluate(() => { window.__mathScene.text = '8 + 8'; });
      await page.waitForTimeout(400);
      assert.equal(await resultado.innerText(), '15', 'pausa fixa a resposta');
      await page.evaluate(() => { window.__mathScene.text = '2 + 3 × 4'; });
      await page.getByRole('button', { name: 'Retomar', exact: true }).click();
      await resultado.filter({ hasText: /^14$/ }).waitFor({ timeout: 12000 }).catch(async e => {
        console.log('Retomar:', await page.locator('.math-live').innerText(), await page.evaluate(() => window.__mathOcr && { text: window.__mathOcr.text, confidence: window.__mathOcr.confidence }));
        throw e;
      });
      await page.evaluate(() => { Object.assign(window.__mathScene, { text: '8 ÷ 2(2 + 2) = ?', dark: true, jitter: 2 }); });
      // Regressão do relato: OCR inglês confunde ÷ e ?. Exigir leitura
      // visível/revisável, não falsear reconhecimento perfeito desta imagem.
      await page.getByLabel('Texto detectado').waitFor({ timeout: 18000 }).catch(async e => {
        console.log('Quadro escuro e tremor:', await page.locator('.math-live').innerText(), await page.evaluate(() => window.__mathOcr && { text: window.__mathOcr.text, confidence: window.__mathOcr.confidence }));
        await page.evaluate(() => { window.__mathScene.jitter = 0; });
        await page.waitForTimeout(3000);
        console.log('Mesma cena sem tremor:', await page.locator('.math-live').innerText());
        throw e;
      });
      assert.equal(await resultado.count(), 0, 'OCR incerto da imagem não vira resultado automático');
      await page.getByRole('button', { name: 'Digitar fórmula', exact: true }).click();
      await page.getByLabel('Expressão matemática', { exact: true }).fill('8 ÷ 2(2 + 2) = ?');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await page.getByRole('button', { name: /Dividir e depois multiplicar/ }).click();
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await resultado.filter({ hasText: /^16$/ }).waitFor();
      await page.getByLabel('Expressão matemática', { exact: true }).fill('8 ÷ 2(2 + 2) = ?');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await page.getByRole('button', { name: /Dividir pelo produto inteiro/ }).click();
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await resultado.filter({ hasText: /^1$/ }).waitFor();
      await page.getByRole('button', { name: 'Voltar ao vivo' }).click();
      await page.evaluate(() => { Object.assign(window.__mathScene, { text: '8 + 7', dark: true, jitter: 2 }); });
      await resultado.filter({ hasText: /^15$/ }).waitFor({ timeout: 18000 });
      await page.getByRole('button', { name: 'Fotografar expressão matemática' }).click();
      await page.locator('.math-preview').waitFor({ timeout: 18000 });
      assert.match(await page.getByLabel('Expressão matemática', { exact: true }).inputValue(), /8\s*\+\s*7/);
      await page.evaluate(() => { window.__mathScene.text = '3 + 3'; });
      await page.waitForTimeout(500);
      assert.match(await page.getByLabel('Expressão matemática', { exact: true }).inputValue(), /8\s*\+\s*7/, 'foto capturada não acompanha o vídeo');
      assert.equal(leiturasIA, 0, 'disparador usa OCR local, não envia fotos escondido');
      const fotoVisivel = await page.locator('.math-preview').evaluate(async img => {
        const bytes = new Uint8Array(await (await fetch(img.src)).arrayBuffer());
        return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
      });
      await page.getByLabel('Operação matemática').selectOption('derivar');
      await page.getByRole('button', { name: 'Ler fórmula com IA' }).click();
      await page.locator('.math-note').filter({ hasText: 'Leitura da IA' }).waitFor();
      assert.equal(fotoEnviadaIA, fotoVisivel, 'IA recebe a foto exibida, mesmo depois de mover a câmera');
      assert.equal(await page.getByLabel('Operação matemática').inputValue(), 'derivar', 'IA não troca a operação escolhida pelo aluno');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await resultado.filter({ hasText: /^2\*x$/ }).waitFor();
      await page.getByRole('button', { name: 'Voltar ao vivo' }).click();
      console.log(`${width}px: fundo escuro, tremor, = ?, agrupamento e fotografia local OK.`);
      await page.evaluate(() => { window.__mathScene.blank = true; });
      await resultado.waitFor({ state: 'hidden', timeout: 4000 });
      await page.getByRole('button', { name: 'Digitar fórmula', exact: true }).click();
      await page.getByLabel('Operação matemática').selectOption('auto');
      await page.getByLabel('Expressão matemática', { exact: true }).fill('f(x)=(x^3+6*x^2-3)/(x+4)');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await page.getByRole('alert').filter({ hasText: 'Escolha' }).waitFor();
      assert.equal(await resultado.count(), 0, 'não adivinhar uma pergunta para a função');
      await page.getByLabel('Operação matemática').selectOption('avaliar');
      await page.getByLabel('Valor da variável').fill('0');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await resultado.filter({ hasText: /^-3\/4$/ }).waitFor();
      await page.getByLabel('Valor da variável').fill('-4');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await page.locator('.math-error').filter({ hasText: 'domínio' }).waitFor();
      assert.equal(await resultado.count(), 0, 'ponto fora do domínio não vira resultado');
      await page.getByLabel('Expressão matemática', { exact: true }).fill('x^3+sin(x)');
      await page.getByLabel('Operação matemática').selectOption('derivar');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await resultado.filter({ hasText: '3*x^2+cos(x)' }).waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: 'Entender o resultado' }).click();
      assert.match(await page.locator('.math-explanation').innerText(), /relação a x/);
      await page.getByLabel('Expressão matemática', { exact: true }).fill('x^2');
      assert.equal(await resultado.count(), 0, 'editar invalida resposta anterior');
      await page.getByLabel('Operação matemática').selectOption('definida');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await resultado.filter({ hasText: /^1\/3$/ }).waitFor({ timeout: 8000 });
      await page.getByLabel('Expressão matemática', { exact: true }).fill('1/x');
      await page.getByLabel('Limite inferior').fill('-1');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await page.locator('.math-error').filter({ hasText: 'polinômios' }).waitFor();
      assert.equal(await resultado.count(), 0);
      await page.getByRole('button', { name: 'Voltar ao vivo' }).click();
      await page.getByLabel('Operação matemática').selectOption('auto');
      await page.getByRole('button', { name: 'Ler fórmula com IA' }).click();
      await page.locator('.math-note').filter({ hasText: 'Leitura da IA' }).waitFor();
      assert.equal(await resultado.count(), 0, 'IA precisa de revisão antes de calcular');
      assert.equal(await page.getByLabel('Expressão matemática', { exact: true }).inputValue(), 'x^2');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await resultado.filter({ hasText: '(1/3)*x^3 + C' }).waitFor();
      await page.waitForTimeout(100);
      const visivel = await resultado.evaluate(el => {
        const r = el.getBoundingClientRect(), c = el.closest('.math-card').getBoundingClientRect();
        return r.top >= c.top && r.bottom <= c.bottom;
      });
      assert.ok(visivel, 'resultado precisa estar dentro da parte visível do card');
      assert.equal(leiturasIA, 2);
      if (process.env.MATH_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MATH_SCREENSHOT_DIR}/matematica-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Documentos', exact: true }).click();
      assert.equal(await page.locator('.math-live').count(), 0);
      await page.getByRole('button', { name: 'Matemática', exact: true }).click();
      await page.locator('.math-live').waitFor();
      await page.getByRole('button', { name: 'Ler fórmula com IA' }).click();
      await page.getByRole('button', { name: 'Voltar ao vivo' }).click();
      assert.equal(await page.getByLabel('Expressão matemática', { exact: true }).count(), 0, 'cancelamento não reabre o editor');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      console.log(`${width}px: derivada, integral, singularidade, revisão da IA e troca de modo OK.`);
      await context.close();
    }
  } finally { await browser.close(); servidor?.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
