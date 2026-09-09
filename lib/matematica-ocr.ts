import type { Worker } from "tesseract.js";

export const CAMINHO_OCR = "/vendor/math-ocr/7.0.0";

export async function criarLeitorMatematico(progresso: (valor: number) => void): Promise<Worker> {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: `${CAMINHO_OCR}/worker.min.js`,
    corePath: CAMINHO_OCR,
    langPath: CAMINHO_OCR,
    workerBlobURL: false,
    cachePath: "insight-math-ocr-7",
    logger: ({ status, progress }) => {
      if (status === "loading tesseract core") progresso(Math.round(progress * 25));
      if (status === "loading language traineddata") progresso(25 + Math.round(progress * 50));
      if (status === "initializing api") progresso(75 + Math.round(progress * 25));
    },
    // Rejeita pelo Promise da biblioteca; não lança erro global no navegador.
    errorHandler: () => {},
  }, {
    load_system_dawg: "0", load_freq_dawg: "0", load_punc_dawg: "0",
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      preserve_interword_spaces: "1",
      user_defined_dpi: "150",
    });
    // Não usar whitelist: ela apagaria palavras/símbolos estranhos e poderia
    // transformar conteúdo não matemático em uma conta aparentemente válida.
    return worker;
  } catch (erro) {
    await worker.terminate();
    throw erro;
  }
}
