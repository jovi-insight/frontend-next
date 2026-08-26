import assert from "node:assert";
import { criarVtt, marcarTempo } from "../.teste-build/video-vtt.js";

// WebVTT exige hora sempre presente e 3 casas de milissegundo: um zero a menos
// e o navegador descarta a cue sem avisar.
assert.strictEqual(marcarTempo(0), "00:00:00.000");
assert.strictEqual(marcarTempo(3.8), "00:00:03.800");
assert.strictEqual(marcarTempo(75.25), "00:01:15.250");
assert.strictEqual(marcarTempo(3661.5), "01:01:01.500");
assert.strictEqual(marcarTempo(-5), "00:00:00.000");

{
  const vtt = criarVtt([
    { start: 0, end: 1, text: "Bom dia, turma." },
    { start: 1, end: 3.8, text: "Hoje vamos estudar a fotossíntese." },
  ]);
  assert.ok(vtt.startsWith("WEBVTT\n"));
  assert.ok(vtt.includes("00:00:01.000 --> 00:00:03.800"));
  assert.ok(vtt.includes("Hoje vamos estudar a fotossíntese."));
}

// Cue de duração zero nunca aparece: o fim é empurrado.
assert.ok(criarVtt([{ start: 2, end: 2, text: "oi" }]).includes("00:00:02.000 --> 00:00:02.100"));

// Trecho vazio não vira cue.
assert.strictEqual(criarVtt([{ start: 0, end: 1, text: "   " }]).trim(), "WEBVTT");

// "-->" no texto encerraria a cue no meio do caminho.
assert.ok(criarVtt([{ start: 0, end: 1, text: "a --> b" }]).includes("a → b"));

console.log("video-vtt.test.mjs OK");
