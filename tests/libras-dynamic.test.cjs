/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const LibrasAlphabetRecognizer = require('../public/vendor/libras-recognizer.js');

function motionSamples(key, points, flag) {
  return points.map(([x, y], index) => ({
    time: index * 100,
    scale: 1,
    indexOnly: false,
    pinkyOnly: false,
    cShape: false,
    indexScreen: { x: 0, y: 0 },
    pinkyScreen: { x: 0, y: 0 },
    wrist: { x: 0, y: 0 },
    [key]: { x, y },
    [flag]: true,
  }));
}

function mirrored(points) {
  return points.map(([x, y]) => [-x, y]);
}

function detect(points, key, flag) {
  const recognizer = new LibrasAlphabetRecognizer();
  recognizer.motionBuffer = motionSamples(key, points, flag);
  return recognizer.detectDynamicLetter(1_000)?.letter ?? null;
}

assert.deepEqual(
  LibrasAlphabetRecognizer.staticLetters.slice(-2),
  ['X', 'Y'],
  'X e Y precisam estar novamente disponíveis para reconhecimento e coleta',
);

const local = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
local[5].y = 0.6;
const geometry = {
  local,
  screenDirection: { x: 0, y: -1 },
  cameraFacing: 1,
  contacts: {
    indexMiddle: 1,
    middleRing: 1,
    ringPinky: 1,
    thumbIndex: 0.9,
    thumbMiddle: 0.9,
    thumbRing: 0.9,
    thumbPinky: 2,
    indexPinky: 1.5,
    thumbIndexMcp: 0.4,
    thumbMiddlePip: 1,
  },
};
const shapeRecognizer = new LibrasAlphabetRecognizer();
assert.equal(
  shapeRecognizer.classifyLibrasConfiguration({ ...geometry, extension: [0.9, 0.05, 0.05, 0.05, 1] })?.letter,
  'Y',
  'polegar e mínimo estendidos precisam distinguir Y de I',
);
assert.equal(
  shapeRecognizer.classifyLibrasConfiguration({
    ...geometry,
    extension: [0.2, 0.4, 0.05, 0.05, 0.05],
    contacts: { ...geometry.contacts, thumbPinky: 0.5 },
  })?.letter,
  'X',
  'indicador em gancho precisa reconhecer X',
);

const j = [
  [0, 0], [0.01, 0.08], [0, 0.17], [0.01, 0.26],
  [0.02, 0.35], [0.07, 0.4], [0.15, 0.38], [0.24, 0.32],
];
assert.equal(detect(j, 'pinkyScreen', 'pinkyOnly'), 'J');
assert.equal(detect(mirrored(j), 'pinkyScreen', 'pinkyOnly'), 'J');
assert.equal(
  detect([[0, 0], [0, 0.08], [0, 0.16], [0, 0.24], [0, 0.32], [0, 0.4], [0, 0.48]], 'pinkyScreen', 'pinkyOnly'),
  null,
  'um I apenas deslocado não pode virar J',
);

const z = [
  [0, 0], [0.15, 0], [0.3, 0.01], [0.45, 0],
  [0.32, 0.08], [0.19, 0.17], [0.05, 0.26],
  [0.18, 0.27], [0.32, 0.26], [0.47, 0.27],
];
assert.equal(detect(z, 'indexScreen', 'indexOnly'), 'Z');
assert.equal(detect(mirrored(z), 'indexScreen', 'indexOnly'), 'Z');
assert.equal(
  detect([[0, 0], [0.1, 0], [0.2, 0], [0.3, 0], [0.4, 0], [0.5, 0], [0.6, 0], [0.7, 0], [0.8, 0]], 'indexScreen', 'indexOnly'),
  null,
  'um risco único não pode virar Z',
);

const cedilla = [
  [0, 0], [0.14, 0.01], [0.3, 0.02], [0.16, 0.02],
  [0, 0.01], [-0.16, 0], [-0.02, -0.01], [0.16, 0],
];
assert.equal(detect(cedilla, 'wrist', 'cShape'), 'Ç');
assert.equal(
  detect([[0, 0], [0.08, 0], [0.16, 0], [0.24, 0], [0.32, 0], [0.4, 0], [0.48, 0], [0.56, 0]], 'wrist', 'cShape'),
  null,
  'mover a mão em C apenas para um lado não pode virar Ç',
);

const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
landmarks[8] = { x: 0.1, y: 0.1, z: 0 };
landmarks[20] = { x: 0.2, y: 0.2, z: 0 };
const descriptor = (extension) => ({
  lm: landmarks,
  scale: 1,
  extension,
  contacts: { thumbIndex: 0.2 },
});
const postureRecognizer = new LibrasAlphabetRecognizer();
postureRecognizer.updateMotion(descriptor([0.9, 0.05, 0.05, 0.05, 1]), 0);
assert.equal(postureRecognizer.motionBuffer[0].pinkyOnly, false, 'Y não pode iniciar a trajetória de J');
postureRecognizer.updateMotion(descriptor([0.2, 0.05, 0.05, 0.05, 1]), 100);
assert.equal(postureRecognizer.motionBuffer[1].pinkyOnly, true, 'I com polegar recolhido deve permitir iniciar J');

const storage = new Map([
  ['jovi.libras.calibration.v5', JSON.stringify({
    version: 5,
    samples: { A: [[1]], X: [[2]], Y: [[3]] },
  })],
]);
global.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const cleaned = new LibrasAlphabetRecognizer();
assert.deepEqual(Object.keys(cleaned.calibration), ['A'], 'somente os registros antigos de X/Y devem ser descartados');
const persisted = JSON.parse(storage.get('jovi.libras.calibration.v5'));
persisted.samples.X = [[4]];
storage.set('jovi.libras.calibration.v5', JSON.stringify(persisted));
const recollected = new LibrasAlphabetRecognizer();
assert.deepEqual(recollected.calibration.X, [[4]], 'novas amostras limpas de X precisam ser preservadas');

storage.clear();
const newDevice = new LibrasAlphabetRecognizer();
assert.deepEqual(newDevice.calibration, {});
assert.equal(storage.get('jovi.libras.xy-clean.v1'), '1');
storage.set('jovi.libras.calibration.v5', JSON.stringify({ version: 5, samples: { X: [[5]] } }));
const firstCleanTraining = new LibrasAlphabetRecognizer();
assert.deepEqual(firstCleanTraining.calibration.X, [[5]], 'o primeiro treino de X em aparelho novo não pode ser apagado');
delete global.localStorage;

console.log('libras-dynamic.test.cjs: ok');
