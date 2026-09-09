// Opt-in: uma chamada REAL ao provedor. Vídeo sintético, sem dados do aluno.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');

async function main() {
  if (process.env.MATH_TEST_REAL_API !== '1') throw new Error('Este teste usa a IA real. Confirme com MATH_TEST_REAL_API=1.');
  const casos = {
    aritmetica: { foto: '8 ÷ 2(2 + 2) = ?', expressao: '8/2(2+2)', operacao: 'auto' },
    derivada: { foto: 'd/dx (x^2 + sin(x))', expressao: 'x^2+sin(x)', operacao: 'derivar', resultado: '2*x+cos(x)' },
    integral: { foto: '∫ x^2 dx', expressao: 'x^2', operacao: 'integrar', resultado: '(1/3)*x^3 + C' },
    fracao: { foto: 'fracao-empilhada', expressao: '(x^3+6*x^2-3)/(x+4)', operacao: 'auto', fracao: true },
  };
  const caso = casos[process.env.MATH_TEST_IA_CASO || 'aritmetica'];
  assert.ok(caso, 'MATH_TEST_IA_CASO deve ser aritmetica, derivada, integral ou fracao.');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let chamadas = 0;
    await context.route('https://backend-rhlz.onrender.com/**', async route => {
      if (route.request().url().includes('/matematica/ler-formula')) {
        if (route.request().method() === 'POST' && ++chamadas > 1) return route.abort();
        return route.continue();
      }
      // Impede consumo de lembretes ou acesso a conteúdos reais na inicialização.
      return route.fulfill({ contentType: 'application/json', body: '[]' });
    });
    const page = await context.newPage();
    const erros = []; page.on('pageerror', erro => erros.push(erro.message));
    await page.addInitScript((texto) => {
      localStorage.setItem('jovi_pwa_prompt_dismissed', '1');
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
        const ctx = canvas.getContext('2d');
        const pintar = () => {
          ctx.fillStyle = '#192724'; ctx.fillRect(0, 0, 1280, 720);
          const moldura = document.querySelector('.math-frame')?.getBoundingClientRect();
          const video = document.querySelector('.camera-video')?.getBoundingClientRect();
          if (moldura && video) {
            const escala = Math.max(video.width / 1280, video.height / 720);
            const x = (moldura.x + moldura.width / 2 - video.x - video.width / 2) / escala + 640;
            const y = (moldura.y + moldura.height / 2 - video.y - video.height / 2) / escala + 360;
            ctx.fillStyle = '#f5f5f5'; ctx.font = '32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if (texto === 'fracao-empilhada') {
              // Reconstrução tipográfica do relato; NÃO é o anexo original.
              ctx.fillStyle = '#fff'; ctx.fillRect(x - 145, y - 42, 290, 84);
              ctx.fillStyle = '#111'; ctx.font = 'italic 25px Times New Roman';
              ctx.fillText('f(x) =', x - 100, y);
              ctx.fillText('x³ + 6x² − 3', x + 28, y - 19);
              ctx.fillText('x + 4', x + 28, y + 20);
              ctx.fillRect(x - 42, y, 140, 1.5);
            } else ctx.fillText(texto, x, y);
          }
          requestAnimationFrame(pintar);
        };
        pintar(); return canvas.captureStream(15);
      };
    }, caso.foto);
    await page.goto(process.env.MATH_TEST_URL || 'https://frontend-next-topaz-mu.vercel.app', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Matemática', exact: true }).click();
    await page.waitForTimeout(300); // Permite que o vídeo desenhe a moldura recém-montada.
    const recebimento = page.waitForResponse(r => r.url().endsWith('/matematica/ler-formula') && r.request().method() === 'POST', { timeout: 25000 });
    const inicio = performance.now();
    await page.getByRole('button', { name: 'Ler fórmula com IA', exact: true }).click();
    const resposta = await recebimento, dados = await resposta.json();
    assert.equal(resposta.status(), 200, JSON.stringify(dados));
    console.log(`IA real pela câmera: ${Math.round(performance.now() - inicio)} ms; transcrição: ${dados.expressao}; operação: ${dados.operacao}`);
    // 6x e 6*x são equivalentes; não remover parênteses nem reagrupar frações.
    const normalizar = texto => texto.replace(/\s/g, '').replace(/÷/g, '/').replace(/(\d)([a-z])/g, '$1*$2');
    assert.equal(normalizar(dados.expressao), normalizar(caso.expressao), 'preservar expressão da imagem');
    assert.equal(dados.operacao, caso.operacao);
    const entrada = page.getByLabel('Expressão matemática', { exact: true });
    await page.locator('.math-note').filter({ hasText: 'Leitura da IA' }).waitFor();
    assert.equal((await entrada.inputValue()).replace(/\s/g, ''), dados.expressao.replace(/\s/g, ''));
    const resultado = page.getByLabel('Resultado matemático');
    assert.equal(await resultado.count(), 0, 'IA não calcula antes da revisão');
    await page.getByRole('button', { name: 'Conferir e calcular' }).click();
    if (caso.fracao) {
      await page.getByRole('alert').filter({ hasText: 'Escolha' }).waitFor();
      assert.equal(await resultado.count(), 0, 'função sem pergunta não vira derivada por adivinhação');
      await page.getByLabel('Operação matemática').selectOption('avaliar');
      await page.getByLabel('Valor da variável').fill('0');
      await page.getByRole('button', { name: 'Conferir e calcular' }).click();
      await resultado.filter({ hasText: /^-3\/4$/ }).waitFor();
      assert.equal(chamadas, 1); assert.deepEqual(erros, []);
      console.log('Fração 2D → IA real → operação explícita → f(0) = -3/4 OK.');
      return;
    }
    if (caso.resultado) {
      await resultado.filter({ hasText: caso.resultado }).waitFor();
      assert.equal(chamadas, 1); assert.deepEqual(erros, []);
      console.log(`Captura → IA real → revisão → ${caso.operacao}: ${caso.resultado} OK.`);
      return;
    }
    await page.getByRole('group', { name: 'Confirmar agrupamento' }).waitFor();
    assert.equal(await resultado.count(), 0, 'não escolher agrupamento silenciosamente');
    await page.getByRole('button', { name: /Dividir e depois multiplicar/ }).click();
    await page.getByRole('button', { name: 'Conferir e calcular' }).click();
    await resultado.filter({ hasText: /^16$/ }).waitFor();
    await entrada.fill('8/2(2+2)');
    await page.getByRole('button', { name: 'Conferir e calcular' }).click();
    await page.getByRole('button', { name: /Dividir pelo produto inteiro/ }).click();
    await page.getByRole('button', { name: 'Conferir e calcular' }).click();
    await resultado.filter({ hasText: /^1$/ }).waitFor();
    assert.equal(chamadas, 1); assert.deepEqual(erros, []);
    if (process.env.MATH_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MATH_SCREENSHOT_DIR}/matematica-ia-real.png`, fullPage: true });
    console.log('Captura → IA real → revisão → agrupamentos 16/1: OK. Nenhum dado persistido.');
  } finally { await browser.close(); }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
