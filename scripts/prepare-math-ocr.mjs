// Assets do leitor servidos pelo próprio app: sem CDN no caminho da câmera.
// Gerados de dependências fixadas no lockfile, durante dev/build.
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(raiz, "public/vendor/math-ocr/7.0.0");
const pacote = (nome) => path.dirname(require.resolve(`${nome}/package.json`));
await mkdir(destino, { recursive: true });
const core = pacote("tesseract.js-core");
// Deixe o Tesseract escolher SIMD/relaxed-SIMD conforme o aparelho.
for (const arquivo of await readdir(core)) {
  if (/^tesseract-core.*\.wasm(?:\.js)?$/.test(arquivo) || arquivo === "LICENSE") {
    await copyFile(path.join(core, arquivo), path.join(destino, arquivo));
  }
}
await copyFile(path.join(pacote("tesseract.js"), "dist/worker.min.js"), path.join(destino, "worker.min.js"));
await copyFile(path.join(pacote("@tesseract.js-data/eng"), "4.0.0_best_int/eng.traineddata.gz"), path.join(destino, "eng.traineddata.gz"));
await copyFile(path.join(pacote("nerdamer"), "license.txt"), path.join(destino, "NERDAMER-LICENSE.txt"));
await copyFile(path.join(pacote("@tesseract.js-data/eng"), "package.json"), path.join(destino, "ENG-PACKAGE.json"));
console.log("Leitor matemático local preparado em /vendor/math-ocr/7.0.0");
