/** Normaliza iluminação e texto claro em quadro escuro, sem remover símbolos. */
export function prepararImagemMatematica(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const histograma = new Uint32Array(256), pixels = imagem.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const cinza = Math.round(pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114);
    histograma[cinza]++; pixels[i] = pixels[i + 1] = pixels[i + 2] = cinza;
  }
  const percentil = (proporcao: number) => {
    let soma = 0;
    for (let i = 0; i < 256; i++) { soma += histograma[i]; if (soma >= pixels.length / 4 * proporcao) return i; }
    return 255;
  };
  const inverter = percentil(.5) < 128;
  const minimo = percentil(.02), maximo = percentil(.98), amplitude = maximo - minimo;
  for (let i = 0; i < pixels.length; i += 4) {
    const valor = amplitude > 35 ? Math.min(255, Math.max(0, (pixels[i] - minimo) * 255 / amplitude)) : pixels[i];
    pixels[i] = pixels[i + 1] = pixels[i + 2] = inverter ? 255 - valor : valor;
  }
  ctx.putImageData(imagem, 0, 0);
}
