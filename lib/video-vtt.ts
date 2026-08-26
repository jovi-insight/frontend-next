/**
 * Transcrição temporizada convertida em WebVTT. Porte de frontend/js/video-vtt.js.
 *
 * A legenda usa a faixa nativa do <video> em vez de um elemento sobreposto: o
 * app é de celular, e no celular a aula é assistida em tela cheia. Um overlay
 * nosso some no fullscreen, porque o navegador promove só o elemento <video>.
 * A faixa nativa continua lá, e ainda respeita o tamanho de legenda que o
 * aluno configurou no próprio sistema.
 */

import type { Segmento } from "./video-library";

/**
 * WebVTT exige HH:MM:SS.mmm, com hora sempre presente e milissegundo com três
 * casas. Um zero a menos e o navegador descarta a cue em silêncio.
 */
export function marcarTempo(segundos: number): string {
  const total = Math.max(0, Number(segundos) || 0);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = total % 60;
  const inteiros = Math.floor(resto);
  const ms = Math.round((resto - inteiros) * 1000);
  return (
    `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}` +
    `:${String(inteiros).padStart(2, "0")}.${String(ms).padStart(3, "0")}`
  );
}

export function criarVtt(segmentos: Segmento[]): string {
  const linhas = ["WEBVTT", ""];
  for (const [indice, segmento] of (segmentos ?? []).entries()) {
    const texto = String(segmento?.text ?? "").trim();
    if (!texto) continue;
    const inicio = Number(segmento.start) || 0;
    // Uma cue de duração zero ou negativa nunca é exibida.
    const fim = Math.max(inicio + 0.1, Number(segmento.end) || 0);
    linhas.push(
      String(indice + 1),
      `${marcarTempo(inicio)} --> ${marcarTempo(fim)}`,
      // "-->" dentro do texto encerraria a cue no meio.
      texto.replace(/-->/g, "→"),
      "",
    );
  }
  return linhas.join("\n");
}
