"use client";

import { useCallback, useRef, useState } from "react";

const TIPOS = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

function melhorTipo(): string | null {
  if (typeof MediaRecorder !== "function" || !MediaRecorder.isTypeSupported) return null;
  return TIPOS.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

/**
 * Grava a aula em vídeo enquanto a fala é transcrita.
 *
 * O stream da câmera é só vídeo (o microfone pertence ao reconhecimento de
 * fala), então pedimos uma faixa de áudio própria. Se o navegador não aceitar
 * dois consumidores do microfone, grava sem som — a legenda, que é o ponto,
 * continua lá.
 */
export function useGravador() {
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const faixaAudioRef = useRef<MediaStreamTrack | null>(null);
  const [gravandoVideo, setGravandoVideo] = useState(false);

  const iniciar = useCallback(async (streamVideo: MediaStream | null) => {
    const tipo = melhorTipo();
    const faixaVideo = streamVideo?.getVideoTracks()[0];
    if (!tipo || !faixaVideo) return false;

    let faixaAudio: MediaStreamTrack | null = null;
    try {
      const som = await navigator.mediaDevices.getUserMedia({ audio: true });
      faixaAudio = som.getAudioTracks()[0] ?? null;
    } catch {
      faixaAudio = null; // segue sem som
    }

    try {
      const mistura = new MediaStream(faixaAudio ? [faixaVideo, faixaAudio] : [faixaVideo]);
      pedacosRef.current = [];
      const gravador = new MediaRecorder(mistura, { mimeType: tipo });
      gravador.ondataavailable = (e) => {
        if (e.data?.size) pedacosRef.current.push(e.data);
      };
      // A faixa de áudio é nossa, não do stream da câmera: quem ligou desliga,
      // senão o indicador de microfone fica aceso depois da aula.
      gravador.onstop = () => faixaAudio?.stop();
      gravador.start(1000);
      gravadorRef.current = gravador;
      faixaAudioRef.current = faixaAudio;
      setGravandoVideo(true);
      return true;
    } catch (e) {
      console.warn("Não foi possível gravar o vídeo da aula:", e);
      faixaAudio?.stop();
      return false;
    }
  }, []);

  /** Encerra e devolve o arquivo, ou null se não havia gravação. */
  const parar = useCallback((): Promise<File | null> => {
    const gravador = gravadorRef.current;
    gravadorRef.current = null;
    setGravandoVideo(false);
    if (!gravador) return Promise.resolve(null);

    return new Promise((resolve) => {
      gravador.addEventListener(
        "stop",
        () => {
          faixaAudioRef.current?.stop();
          faixaAudioRef.current = null;
          const pedacos = pedacosRef.current;
          pedacosRef.current = [];
          if (!pedacos.length) return resolve(null);
          const tipo = gravador.mimeType || "video/webm";
          const extensao = tipo.includes("mp4") ? "mp4" : "webm";
          const blob = new Blob(pedacos, { type: tipo });
          resolve(
            new File([blob], `aula-${new Date().toISOString().slice(0, 16)}.${extensao}`, {
              type: tipo,
            }),
          );
        },
        { once: true },
      );
      try {
        gravador.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  return { iniciar, parar, gravandoVideo, disponivel: melhorTipo() !== null };
}
