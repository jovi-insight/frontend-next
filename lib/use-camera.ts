"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LadoCamera = "environment" | "user";
export type Resolucao = "4K" | "1080P";
export type Fps = 30 | 60;
export type ModoFlash = "off" | "on" | "auto";

const RESOLUCOES: Record<Resolucao, { width: number; height: number }> = {
  "4K": { width: 3840, height: 2160 },
  "1080P": { width: 1920, height: 1080 },
};

/**
 * Abre a câmera e mantém o stream. É um celular na mão do aluno, então a
 * traseira ("environment") é o padrão — é ela que aponta para o caderno.
 *
 * getUserMedia exige localhost ou HTTPS; em HTTP comum o navegador nem
 * pergunta, só recusa.
 */
export function useCamera(ativa = true, ladoInicial: LadoCamera = "environment") {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [lado, setLado] = useState<LadoCamera>(ladoInicial);
  const [resolucao, setResolucao] = useState<Resolucao>("1080P");
  const [fps, setFps] = useState<Fps>(30);
  const [zoom, setZoom] = useState<number>(1);
  const [capacidadesZoom, setCapacidadesZoom] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoomNativo, setZoomNativo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronta, setPronta] = useState(false);
  const [temLanterna, setTemLanterna] = useState(false);
  /** O que a câmera entregou de fato — pode ser menor que o pedido. */
  const [real, setReal] = useState<{ largura: number; altura: number; fps: number } | null>(null);

  // Reabre o stream quando lado, resolução ou fps mudam: são constraints de
  // captura, não ajustes aplicáveis a quente de forma confiável.
  useEffect(() => {
    if (!ativa) return;
    let cancelado = false;

    async function abrir() {
      setPronta(false);
      setErro(null);
      setZoom(1);
      setZoomNativo(false);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este navegador não expõe a câmera.");
        }
        const alvo = RESOLUCOES[resolucao];
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: lado,
            width: { ideal: alvo.width },
            height: { ideal: alvo.height },
            frameRate: { ideal: fps },
          },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        const track = stream.getVideoTracks()[0];
        const conf = track?.getSettings?.();
        setReal(
          conf
            ? { largura: conf.width ?? 0, altura: conf.height ?? 0, fps: Math.round(conf.frameRate ?? 0) }
            : null,
        );

        // Inspeciona capacidades de lanterna e zoom
        const capacidades = track?.getCapabilities?.() as
          | { torch?: boolean; zoom?: { min: number; max: number; step: number } }
          | undefined;

        setTemLanterna(Boolean(capacidades?.torch));
        if (capacidades?.zoom) {
          setZoomNativo(true);
          setCapacidadesZoom({
            min: capacidades.zoom.min || 1,
            max: capacidades.zoom.max || 5,
            step: capacidades.zoom.step || 0.1,
          });
        } else {
          setZoomNativo(false);
          setCapacidadesZoom({ min: 1, max: 5, step: 0.1 });
        }

        setPronta(true);
      } catch (e) {
        if (cancelado) return;
        const nome = (e as Error).name;
        setErro(
          nome === "NotAllowedError"
            ? "Permissão de câmera negada. Libere o acesso nas configurações do site."
            : nome === "NotFoundError"
              ? "Nenhuma câmera encontrada neste aparelho."
              : nome === "OverconstrainedError"
                ? `Esta câmera não suporta ${resolucao} a ${fps}fps. Escolha outra qualidade.`
                : `${(e as Error).message} — a câmera exige localhost ou HTTPS.`,
        );
      }
    }

    abrir();

    // Sem parar as tracks, a luz da câmera fica acesa depois de sair da tela.
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [ativa, lado, resolucao, fps]);

  const trocarLado = useCallback(
    () => setLado((l) => (l === "environment" ? "user" : "environment")),
    [],
  );

  /** Ajusta o zoom óptico/digital da câmera com fallback via CSS/Canvas */
  const ajustarZoom = useCallback(async (novoZoom: number) => {
    const minimo = Math.max(1, capacidadesZoom?.min ?? 1);
    const maximo = Math.max(minimo, Math.min(5, capacidadesZoom?.max ?? 5));
    const valor = Math.max(minimo, Math.min(maximo, Number(novoZoom) || minimo));
    setZoom(valor);
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && zoomNativo) {
      try {
        await track.applyConstraints({
          advanced: [{ zoom: valor } as MediaTrackConstraintSet],
        });
      } catch {
        // Alguns Androids anunciam zoom nas capacidades, mas rejeitam a
        // constraint durante o stream. A interface continua via CSS/Canvas.
        setZoomNativo(false);
      }
    }
  }, [capacidadesZoom, zoomNativo]);

  /** Lanterna de verdade, via constraint `torch`. */
  const alternarLanterna = useCallback(async (ligar: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return false;
    try {
      await track.applyConstraints({
        advanced: [{ torch: ligar } as MediaTrackConstraintSet],
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Mede o brilho médio do quadro atual (0 = escuro, 255 = claro). Serve ao
   * flash AUTO sem enviar imagem, pedir permissão extra ou depender da IA.
   */
  const medirLuminosidade = useCallback((): number | null => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 24;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let soma = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        soma += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
      }
      return soma / (pixels.length / 4);
    } catch {
      return null;
    }
  }, []);

  /** O stream atual, para quem precisa gravar (modo AULA). */
  const obterStream = useCallback(() => streamRef.current, []);

  /** Quadro atual como JPEG. `largura` 0 mantém a resolução nativa. */
  const capturar = useCallback(
    (largura = 0, qualidade = 0.9, filtro = "", zoomAtual = 1): string | null => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return null;

      const z = Math.max(1, zoomAtual || 1);
      const escala = largura ? largura / video.videoWidth : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * escala);
      canvas.height = Math.round(video.videoHeight * escala);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      if (filtro) ctx.filter = filtro;

      if (z > 1) {
        // Recorte central proporcional ao zoom aplicado na tela
        const sw = video.videoWidth / z;
        const sh = video.videoHeight / z;
        const sx = (video.videoWidth - sw) / 2;
        const sy = (video.videoHeight - sh) / 2;
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      return canvas.toDataURL("image/jpeg", qualidade);
    },
    [],
  );

  return {
    videoRef,
    lado,
    trocarLado,
    resolucao,
    setResolucao,
    fps,
    setFps,
    zoom,
    capacidadesZoom,
    zoomNativo,
    ajustarZoom,
    real,
    temLanterna,
    alternarLanterna,
    medirLuminosidade,
    obterStream,
    capturar,
    erro,
    pronta,
  };
}
