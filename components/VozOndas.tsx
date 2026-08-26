"use client";

import { useEffect, useRef } from "react";

/**
 * Barras que sobem e descem no ritmo da voz.
 *
 * Desenha num <canvas> com requestAnimationFrame em vez de estado do React:
 * a 60 quadros por segundo, um setState re-renderizaria a tela inteira 60
 * vezes por segundo para mexer em meia dúzia de pixels.
 *
 * Sem analisador (voz do navegador, que não passa pela Web Audio) as barras
 * ficam paradas e apagadas — melhor do que fingir um nível que não existe.
 */
export default function VozOndas({
  analisador,
  ativo,
}: {
  analisador: AnalyserNode | null;
  ativo: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dados = analisador ? new Uint8Array(analisador.frequencyBinCount) : null;
    let quadro = 0;

    const cor = () =>
      getComputedStyle(canvas).getPropertyValue("color").trim() || "#9cd0ce";

    function desenhar() {
      if (!canvas || !ctx) return;
      // O canvas tem tamanho de CSS e de bitmap; sem igualar os dois, tudo sai
      // borrado na tela do celular.
      const escala = window.devicePixelRatio || 1;
      const largura = canvas.clientWidth;
      const altura = canvas.clientHeight;
      if (canvas.width !== largura * escala || canvas.height !== altura * escala) {
        canvas.width = largura * escala;
        canvas.height = altura * escala;
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
      }

      ctx.clearRect(0, 0, largura, altura);

      const barras = 16;
      const espaco = 2;
      const larguraBarra = (largura - espaco * (barras - 1)) / barras;
      const minima = 2;

      if (dados && analisador && ativo) analisador.getByteFrequencyData(dados);

      ctx.fillStyle = cor();
      ctx.globalAlpha = ativo && dados ? 1 : 0.3;

      for (let i = 0; i < barras; i++) {
        let nivel = 0;
        if (dados && ativo) {
          // As barras agudas quase não têm energia na voz: pega a faixa útil
          // (grave/médio) espalhada pelas barras, senão metade fica sempre no chão.
          const indice = Math.floor((i / barras) * (dados.length * 0.6));
          nivel = dados[indice] / 255;
        }
        const h = Math.max(minima, nivel * altura);
        const x = i * (larguraBarra + espaco);
        ctx.fillRect(x, (altura - h) / 2, larguraBarra, h);
      }

      quadro = requestAnimationFrame(desenhar);
    }

    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, [analisador, ativo]);

  return (
    <canvas
      ref={canvasRef}
      className="voz-ondas"
      aria-hidden="true"
      // O nível é informação decorativa: quem precisa do estado lê "Narrando".
    />
  );
}
