const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

async function main() {
  const instancias = [], avisos = [];
  let pedirSom, audioParado = 0;
  const audio = { stop: () => audioParado++ };
  class Gravador {
    static isTypeSupported(tipo) { return tipo === 'video/mp4'; }
    constructor(_stream, { mimeType }) { this.mimeType = mimeType; instancias.push(this); }
    start() { this.state = 'recording'; }
    addEventListener(_nome, fn) { this.aoParar = fn; }
    stop() {
      this.state = 'inactive';
      setTimeout(() => {
        this.ondataavailable({ data: new Blob(['final']) });
        this.onstop?.(); this.aoParar?.();
      }, 0);
    }
  }
  const module = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync('lib/use-gravador.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(codigo, {
    module, exports: module.exports, Blob, File, Promise, console,
    MediaRecorder: Gravador, MediaStream: class {}, navigator: { mediaDevices: { getUserMedia: () => pedirSom() } },
    require: nome => nome === 'react' ? { useRef: current => ({ current }), useCallback: fn => fn, useState: value => [value, () => {}] } : { avisar: texto => avisos.push(texto) },
  });
  const gravador = module.exports.useGravador(), camera = { getVideoTracks: () => [{}] };
  let liberarSom;
  pedirSom = () => new Promise(resolve => { liberarSom = resolve; });
  const inicio = gravador.iniciar(camera);
  assert.equal(await gravador.iniciar(camera), false, 'não duplica enquanto aguarda microfone');
  liberarSom({ getAudioTracks: () => [audio] });
  assert.equal(await inicio, true);
  assert.equal(instancias.length, 1);
  instancias[0].ondataavailable({ data: new Blob(['inicio-']) });
  const parada = gravador.parar();
  assert.equal(gravador.parar(), parada, 'toques repetidos aguardam a mesma finalização');
  assert.equal(await gravador.iniciar(camera), false, 'não mistura gravações enquanto recebe o último trecho');
  const arquivo = await parada;
  assert.equal(await arquivo.text(), 'inicio-final');
  assert.equal(arquivo.type, 'video/mp4');
  assert.doesNotMatch(arquivo.name, /:/);
  assert.ok(audioParado > 0);
  pedirSom = async () => { throw new Error('microfone negado'); };
  assert.equal(await gravador.iniciar(camera), true);
  assert.ok(avisos.some(texto => /sem microfone/.test(texto)));
  instancias[1].ondataavailable({ data: new Blob(['recuperavel']) });
  instancias[1].state = 'inactive';
  instancias[1].onerror();
  assert.equal(await (await gravador.parar()).text(), 'recuperavel', 'preserva trechos após interrupção do navegador');
  assert.ok(avisos.some(texto => /interrompida/.test(texto)));
  assert.equal(await gravador.parar(), null);
  console.log('Gravador: início/fim concorrentes, último trecho, MIME/nome, microfone negado e recuperação após erro OK (MediaRecorder simulado).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
