const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

let fetcher;
const loaded = new Map();
function load(file) {
  file = path.resolve(file);
  if (loaded.has(file)) return loaded.get(file);
  const module = { exports: {} }; loaded.set(file, module.exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => load(path.resolve(path.dirname(file), name + '.ts')),
    Blob, File, FormData, Response, Request, AbortController, AbortSignal, Uint8Array, ArrayBuffer, TypeError, Error,
    setTimeout, clearTimeout, fetch: (...args) => fetcher(...args) });
  return module.exports;
}

async function main() {
  const { prepararMidia, erroDeMidia } = load('lib/midia-upload.ts');
  const { transcreverMidia } = load('lib/libras-ml.ts');
  const { enviarVideoUsuario } = load('lib/api.ts');
  const original = new File(['conteudo'], 'aula:22:37.mp4', { type: 'video/mp4;codecs=avc1,mp4a' });
  const arquivo = await prepararMidia(original, original.name, 200);
  assert.equal(arquivo.type, 'video/mp4');
  assert.equal(arquivo.name, 'aula-22-37.mp4');
  assert.equal(await arquivo.text(), await original.text());
  assert.equal(original.type, 'video/mp4;codecs=avc1,mp4a', 'não altera original');
  assert.equal((await prepararMidia(new Blob(['x']), 'a.MOV', 200)).type, 'video/quicktime');
  await assert.rejects(prepararMidia(new Blob([]), 'a.mp4', 200), /vazio/);
  await assert.rejects(prepararMidia(new Blob(['x'], { type: 'text/plain' }), 'a.mp4', 200), /Formato/);
  await assert.rejects(prepararMidia(original, original.name, 0), /limite/);
  const unreadable = new Blob(['x'], { type: 'video/mp4' });
  unreadable.arrayBuffer = async () => { throw new Error('not readable'); };
  await assert.rejects(prepararMidia(unreadable, 'a.mp4', 200), /não limpe os dados/);
  const err = await erroDeMidia(new Response(JSON.stringify({ detail: [{ loc: ['body', 'media'], type: 'missing', msg: 'Field required' }] }), { status: 422 }), 'Transcrição');
  assert.match(err.message, /HTTP 422/); assert.match(err.message, /media/); assert.doesNotMatch(err.message, /Gemini/);
  fetcher = async (url, options) => {
    const req = new Request(url, options), form = await req.formData();
    assert.equal(form.get('media').type, 'video/mp4');
    assert.equal(await form.get('media').text(), 'conteudo');
    assert.ok(!options.headers['Content-Type'], 'boundary pertence ao navegador');
    return new Response(JSON.stringify({ text: 'Teste', segments: [] }));
  };
  assert.equal((await transcreverMidia(original, original.name)).text, 'Teste');
  fetcher = async () => new Response(JSON.stringify({ detail: [{ loc: ['body', 'media'], type: 'missing' }] }), { status: 422 });
  await assert.rejects(transcreverMidia(original, original.name), /campo obrigatório “media”/);
  fetcher = async () => new Response('<html>restarting</html>', { status: 503 });
  await assert.rejects(transcreverMidia(original, original.name), /reiniciando/);
  fetcher = async () => new Response('{}');
  await assert.rejects(transcreverMidia(original, original.name), /transcrição inválida/);
  fetcher = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(transcreverMidia(original, original.name), /permanece no aparelho/);
  const controle = new AbortController(); controle.abort();
  fetcher = async (_url, options) => { assert.ok(options.signal.aborted); const e = new Error(); e.name = 'AbortError'; throw e; };
  await assert.rejects(transcreverMidia(original, original.name, controle.signal), /cancelada/);
  fetcher = async (url, options) => {
    const form = await new Request(url, options).formData();
    assert.equal(form.get('envio_id'), '20fcefb4-8bb8-4b3f-8d8a-a72fdbac9835');
    assert.equal(form.get('duracao'), '0');
    assert.equal(form.get('arquivo').type, 'video/mp4');
    return new Response(JSON.stringify({ id: 'saved' }));
  };
  await enviarVideoUsuario(original, Infinity, '20fcefb4-8bb8-4b3f-8d8a-a72fdbac9835');
  console.log('Upload: bytes, MIME, nome, vazio, leitura, 422 detalhado, 503, rede, cancelamento e idempotência OK (rede simulada).');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
