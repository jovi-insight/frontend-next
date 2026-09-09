// Teste de interface/rede com câmera e IA simuladas. Não mede acurácia da IA.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const { spawn } = require('node:child_process');
const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
const solucao = resultado => ({ status: 'resolvido', resultado, passos: [
  { titulo: 'Respeitar a ordem das operações', explicacao: 'Calcule a multiplicação antes da soma.', formula: '2 + 3 × 4 = 2 + 12' },
  { titulo: 'Concluir a soma', explicacao: 'Some os valores restantes.', formula: '2 + 12 = 14' },
], aviso: null, pergunta: null });

async function main() {
  const servidor = process.env.MATH_TEST_SERVER ? spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3107'], { stdio: 'pipe' }) : null;
  if (servidor) await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor não iniciou.')), 15000);
    servidor.stdout.on('data', chunk => { if (chunk.toString().includes('Ready')) { clearTimeout(timer); resolve(); } });
    servidor.on('exit', code => { clearTimeout(timer); reject(new Error(`Servidor encerrou: ${code}`)); });
  });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      let leituras = 0, pedidos = [], imagens = [], modo = 'normal';
      await context.route('https://backend-rhlz.onrender.com/**', async route => {
        const req = route.request();
        if (req.method() === 'POST' && req.url().endsWith('/matematica/ler-formula')) {
          leituras++;
          const form = await new Response(req.postDataBuffer(), { headers: { 'Content-Type': req.headers()['content-type'] } }).formData();
          const foto = [...form.values()].find(v => typeof v !== 'string');
          assert.ok(foto); imagens.push(Buffer.from(await foto.arrayBuffer()).toString('base64'));
          return route.fulfill({ json: { expressao: '2+3*4', operacao: 'auto', variavel: 'x', inferior: null, superior: null, confianca: 'alta', observacao: null } });
        }
        if (req.method() === 'POST' && req.url().endsWith('/matematica/resolver')) {
          const pedido = req.postDataJSON(); pedidos.push(pedido);
          if (modo === 'quota') return route.fulfill({ status: 429, json: { detail: 'O limite da IA foi atingido.' } });
          if (modo === 'incompleta') return route.fulfill({ json: { ...solucao('14'), passos: [] } });
          if (modo === 'lenta') await pausa(1000);
          if (pedido.expressao.includes('x') && pedido.operacao === 'auto') return route.fulfill({ json: { status: 'precisa_informacao', resultado: null, passos: [], pergunta: 'Escolha o que deseja calcular com a função.', aviso: null } });
          if (pedido.operacao === 'avaliar' && pedido.valor === '-4') return route.fulfill({ json: { status: 'nao_resolvido', resultado: null, passos: [], pergunta: 'A função não está definida em x = -4.', aviso: null } });
          return route.fulfill({ json: solucao(pedido.operacao === 'avaliar' ? '-3/4' : pedido.expressao === '8/2*(2+2)' ? '16' : '14') });
        }
        return route.fulfill({ json: [] });
      });
      const page = await context.newPage(), erros = [], assetsOCR = [], workers = [];
      page.on('pageerror', e => erros.push(e.message));
      page.on('worker', worker => workers.push(worker.url()));
      page.on('request', req => { if (/math-ocr|tesseract|traineddata/.test(req.url())) assetsOCR.push(req.url()); });
      await page.addInitScript(() => {
        localStorage.setItem('jovi_pwa_prompt_dismissed', '1');
        window.__mathText = '2 + 3 × 4';
        navigator.mediaDevices.getUserMedia = async () => {
          const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
          const ctx = canvas.getContext('2d');
          const pintar = () => {
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1280, 720);
            const frame = document.querySelector('.math-frame')?.getBoundingClientRect();
            const video = document.querySelector('.camera-video')?.getBoundingClientRect();
            if (frame && video) {
              const escala = Math.max(video.width / 1280, video.height / 720);
              const x = (frame.x + frame.width / 2 - video.x - video.width / 2) / escala + 640;
              const y = (frame.y + frame.height / 2 - video.y - video.height / 2) / escala + 360;
              ctx.fillStyle = '#111'; ctx.font = '30px Arial'; ctx.textAlign = 'center'; ctx.fillText(window.__mathText, x, y);
            }
            requestAnimationFrame(pintar);
          };
          pintar(); return canvas.captureStream(15);
        };
      });
      await page.goto(process.env.MATH_TEST_URL || 'http://127.0.0.1:3107', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Matemática', exact: true }).click();
      await page.waitForTimeout(2200);
      assert.equal(leituras, 0); assert.equal(pedidos.length, 0); assert.deepEqual(assetsOCR, []); assert.deepEqual(workers, []);
      assert.equal(await page.getByRole('button', { name: /Pausar|Retomar|Digitar fórmula|Conferir e calcular/ }).count(), 0);
      const resultado = page.getByLabel('Resultado matemático');
      await page.getByRole('button', { name: 'Fotografar expressão matemática' }).click();
      await page.locator('.math-note').filter({ hasText: 'Leitura da IA' }).waitFor();
      assert.equal(leituras, 1); assert.equal(pedidos.length, 0); assert.equal(await resultado.count(), 0);
      const entrada = page.getByLabel('Expressão matemática', { exact: true });
      assert.equal(await entrada.inputValue(), '2+3*4');
      await page.evaluate(() => { window.__mathText = '99 + 99'; });
      await page.getByLabel('Operação matemática').selectOption('derivar');
      await page.getByRole('button', { name: 'Reler esta foto com IA' }).click();
      await page.locator('.math-note').filter({ hasText: 'Mantive sua operação' }).waitFor();
      assert.equal(imagens[0], imagens[1]); assert.equal(await page.getByLabel('Operação matemática').inputValue(), 'derivar');
      const fotoNoVisor = await page.getByAltText('Foto da expressão enviada para a IA').evaluate(async img => {
        const bytes = new Uint8Array(await (await fetch(img.src)).arrayBuffer());
        return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
      });
      assert.equal(fotoNoVisor, imagens[0], 'visor mostra a captura original, não a conta nova no vídeo');
      await page.getByLabel('Operação matemática').selectOption('auto');
      const resolver = page.getByRole('button', { name: 'Resolver com IA · passo a passo', exact: true });
      await resolver.click(); await resultado.filter({ hasText: /^14$/ }).waitFor();
      assert.equal(pedidos.length, 1); assert.equal(pedidos[0].expressao, '2+3*4');
      assert.equal(await page.getByLabel('Passo a passo da resolução').locator('li').count(), 2);
      assert.match(await page.getByLabel('Passo a passo da resolução').innerText(), /2 \+ 12 = 14/);
      if (process.env.MATH_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MATH_SCREENSHOT_DIR}/matematica-ia-passos-${width}.png`, fullPage: true });
      await entrada.fill('8/2(2+2)'); assert.equal(await resultado.count(), 0);
      await resolver.click(); await page.getByRole('group', { name: 'Confirmar agrupamento' }).waitFor();
      assert.equal(pedidos.length, 1, 'ambiguidade não vai para a IA antes de escolher');
      await page.getByRole('button', { name: /Dividir e depois multiplicar/ }).click();
      await resolver.click(); await resultado.filter({ hasText: /^16$/ }).waitFor();
      assert.equal(pedidos.at(-1).expressao, '8/2*(2+2)');
      await entrada.fill('f(x)=(x^3+6*x^2-3)/(x+4)');
      await resolver.click(); await page.getByRole('status').filter({ hasText: 'Escolha o que deseja' }).waitFor();
      assert.equal(await resultado.count(), 0);
      await page.getByLabel('Operação matemática').selectOption('avaliar');
      await resolver.click(); await page.locator('.math-error').filter({ hasText: 'Informe' }).waitFor();
      await page.getByLabel('Valor da variável').fill('0');
      await resolver.click(); await resultado.filter({ hasText: /^-3\/4$/ }).waitFor();
      await page.getByLabel('Valor da variável').fill('-4');
      await resolver.click(); await page.getByRole('status').filter({ hasText: 'não está definida' }).waitFor();
      assert.equal(await resultado.count(), 0);
      modo = 'quota'; await resolver.click(); await page.locator('.math-error').filter({ hasText: 'limite' }).waitFor();
      const quantidade = pedidos.length;
      await page.waitForTimeout(1300); assert.equal(pedidos.length, quantidade, 'não repetir em loop após 429');
      assert.equal(await entrada.inputValue(), 'f(x)=(x^3+6*x^2-3)/(x+4)'); assert.equal(await resultado.count(), 0);
      modo = 'incompleta'; await resolver.click(); await page.locator('.math-error').filter({ hasText: 'passo a passo válido' }).waitFor();
      assert.equal(await resultado.count(), 0);
      modo = 'lenta'; await resolver.click();
      await page.getByRole('button', { name: 'Cancelar e voltar à câmera' }).click();
      await page.waitForTimeout(1200); assert.equal(await entrada.count(), 0); assert.equal(await resultado.count(), 0);
      modo = 'normal'; await page.getByRole('button', { name: 'Fotografar e ler com IA' }).click();
      await page.locator('.math-note').filter({ hasText: 'Leitura da IA' }).waitFor();
      assert.notEqual(imagens.at(-1), imagens[0], 'nova foto realmente captura outro quadro');
      await page.getByRole('button', { name: 'Documentos', exact: true }).click();
      assert.equal(await page.locator('.math-live').count(), 0);
      assert.deepEqual(assetsOCR, []); assert.deepEqual(workers, []); assert.deepEqual(erros, []);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      console.log(`${width}px: sem OCR/Workers/envio automático; foto, confirmação, IA, passos, 429 e cancelamento OK.`);
      await context.close();
    }
  } finally { await browser.close(); servidor?.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
