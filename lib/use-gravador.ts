"use client";

import { useCallback, useRef, useState } from "react";
import { avisar } from "./avisos";

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
 * dois consumidores do microfone, avisa que o vídeo ficará sem som.
 */
export function useGravador() {
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const faixaAudioRef = useRef<MediaStreamTrack | null>(null);
  const iniciandoRef = useRef(false);
  const parandoRef = useRef<Promise<File | null> | null>(null);
  const [gravandoVideo, setGravandoVideo] = useState(false);

  const iniciar = useCallback(async (streamVideo: MediaStream | null) => {
    if (gravadorRef.current || iniciandoRef.current || parandoRef.current) return false;
    const tipo = melhorTipo();
    const faixaVideo = streamVideo?.getVideoTracks()[0];
    if (!tipo || !faixaVideo) return false;
    iniciandoRef.current = true;

    let faixaAudio: MediaStreamTrack | null = null;
    try {
      const som = await navigator.mediaDevices.getUserMedia({ audio: true });
      faixaAudio = som.getAudioTracks()[0] ?? null;
    } catch {
      faixaAudio = null; // segue sem som
    }
    if (!faixaAudio) avisar("Gravação sem microfone: o vídeo ficará sem áudio e não poderá ser transcrito. Libere o microfone para gravar com som.", "info");

    try {
      const mistura = new MediaStream(faixaAudio ? [faixaVideo, faixaAudio] : [faixaVideo]);
      const pedacos: Blob[] = [];
      pedacosRef.current = pedacos;
      const gravador = new MediaRecorder(mistura, { mimeType: tipo });
      gravador.ondataavailable = (e) => {
        if (e.data?.size) pedacos.push(e.data);
      };
      // A faixa de áudio é nossa, não do stream da câmera: quem ligou desliga,
      // senão o indicador de microfone fica aceso depois da aula.
      gravador.onstop = () => faixaAudio?.stop();
      gravador.onerror = () => avisar("A gravação foi interrompida pelo navegador. Pare a gravação para salvar o trecho disponível.", "erro");
      gravador.start(1000);
      gravadorRef.current = gravador;
      faixaAudioRef.current = faixaAudio;
      setGravandoVideo(true);
      return true;
    } catch (e) {
      console.warn("Não foi possível gravar o vídeo da aula:", e);
      faixaAudio?.stop();
      return false;
    } finally {
      iniciandoRef.current = false;
    }
  }, []);

  /** Encerra e devolve o arquivo, ou null se não havia gravação. */
  const parar = useCallback((): Promise<File | null> => {
    if (parandoRef.current) return parandoRef.current;
    const gravador = gravadorRef.current;
    gravadorRef.current = null;
    setGravandoVideo(false);
    if (!gravador) return Promise.resolve(null);

    const pedacos = pedacosRef.current;
    const faixaAudio = faixaAudioRef.current;
    const parada = new Promise<File | null>((resolve) => {
      const finalizar = () => {
        faixaAudio?.stop();
        if (faixaAudioRef.current === faixaAudio) faixaAudioRef.current = null;
        if (pedacosRef.current === pedacos) pedacosRef.current = [];
        if (!pedacos.length) return resolve(null);
        const tipo = gravador.mimeType || "video/webm";
        const extensao = tipo.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(pedacos, { type: tipo });
        resolve(new File([blob], `aula-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.${extensao}`, { type: tipo }));
      };
      if (gravador.state === "inactive") { finalizar(); return; }
      gravador.addEventListener("stop", finalizar, { once: true });
      try {
        gravador.stop();
      } catch {
        finalizar();
      }
    });
    parandoRef.current = parada;
    void parada.finally(() => { if (parandoRef.current === parada) parandoRef.current = null; });
    return parada;
  }, []);

  return { iniciar, parar, gravandoVideo, disponivel: melhorTipo() !== null };
}
