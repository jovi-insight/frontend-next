import { recorteCamera } from "./matematica-leitura";

/** Só captura após ação do aluno. Sem loop, OCR, Worker ou envio automático. */
export async function capturarFormula(video: HTMLVideoElement | null, moldura: HTMLElement | null, zoom: number): Promise<Blob> {
  if (!video?.videoWidth || video.readyState < 2 || !moldura) throw new Error("Aguarde a câmera ficar pronta.");
  const box = video.getBoundingClientRect(), frame = moldura.getBoundingClientRect();
  const visor = { width: box.width / zoom, height: box.height / zoom };
  const left = box.left + (box.width - visor.width) / 2, top = box.top + (box.height - visor.height) / 2;
  const recorte = recorteCamera({ width: video.videoWidth, height: video.videoHeight }, visor,
    { x: frame.left - left, y: frame.top - top, width: frame.width, height: frame.height }, zoom);
  if (recorte.width <= 0 || recorte.height <= 0) throw new Error("Não foi possível enquadrar a fórmula.");
  const escala = Math.min(2, 1600 / recorte.width, 1200 / recorte.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(recorte.width * escala); canvas.height = Math.round(recorte.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível capturar a foto.");
  ctx.drawImage(video, recorte.x, recorte.y, recorte.width, recorte.height, 0, 0, canvas.width, canvas.height);
  const foto = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .92));
  if (!foto || foto.size > 2 * 1024 * 1024) throw new Error("Não foi possível preparar a foto. Aproxime apenas a expressão.");
  return foto;
}
