"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inferirLandmarks, statusModelo } from "./libras-ml";

// Pausa após a qual a soletração fecha a palavra atual, como no vanilla.
const PAUSA_DE_PALAVRA = 2000;
const LETRAS_BLOQUEADAS = new Set(["X", "Y"]);

const VERSAO_MEDIAPIPE = "0.4.1675469240";
const CDN_MEDIAPIPE = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${VERSAO_MEDIAPIPE}`;
const scriptsCarregando = new Map<string, Promise<void>>();

export type Landmark = { x: number; y: number; z: number };

export type QuadroLandmarks = {
  landmarks: Landmark[];
  capturadoEm: number;
};

type Resultado = {
  status: "sem-mao" | "incerto" | "movimento" | "estabilizando" | "confirmado";
  letter?: string;
  confidence?: number;
  motion?: { speed: number; moving: boolean };
  dynamic?: boolean;
};

type PredicaoBackendEstavel = {
  letter: string;
  confidence: number;
  recebidaEm: number;
};

type Reconhecedor = {
  process: (landmarks: Landmark[], agora: number) => Resultado;
  resetTracking: () => void;
  addCalibrationSample: (letra: string, landmarks: Landmark[]) => number;
  finishCalibration: () => void;
};

type Hands = {
  setOptions: (o: Record<string, unknown>) => void;
  onResults: (cb: (r: { multiHandLandmarks?: Landmark[][] }) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};

declare global {
  interface Window {
    Hands?: new (config: { locateFile: (f: string) => string }) => Hands;
    LibrasAlphabetRecognizer?: new () => Reconhecedor;
  }
}

/**
 * O MediaPipe Hands roda o modelo pela GPU. Sem WebGL ele cai num caminho de
 * software que trava a thread principal — a página inteira congela e o usuário
 * não consegue nem trocar de modo. Verificado num Chrome headless sem GPU:
 * depois de entrar no modo, nem `1+1` respondia mais.
 */
function temWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

function removerScript(src: string) {
  document.querySelectorAll<HTMLScriptElement>(`script[src="${src}"]`).forEach((tag) => tag.remove());
}

function carregarScript(src: string, disponivel: () => boolean): Promise<void> {
  if (disponivel()) return Promise.resolve();

  const pendente = scriptsCarregando.get(src);
  if (pendente) return pendente;

  // Uma tag que sobrou de uma navegação anterior pode ter falhado ou ainda
  // estar carregando. A Promise compartilhada abaixo passa a ser a fonte da
  // verdade para todas as montagens do hook.
  removerScript(src);

  const carregamentoBruto = new Promise<void>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = src;
    tag.async = true;
    tag.dataset.insightDependencia = "carregando";
    tag.onload = () => {
      tag.dataset.insightDependencia = "carregada";
      if (disponivel()) resolve();
      else reject(new Error(`A dependência ${src} carregou sem ficar disponível.`));
    };
    tag.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(tag);
  });

  const carregamento = carregamentoBruto.finally(() => scriptsCarregando.delete(src));
  scriptsCarregando.set(src, carregamento);
  return carregamento;
}

async function carregarScriptComRetry(
  src: string,
  disponivel: () => boolean,
  mensagem: string,
): Promise<void> {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    try {
      await carregarScript(src, disponivel);
      return;
    } catch (erro) {
      ultimoErro = erro;
      removerScript(src);
      if (tentativa === 0) await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  console.error(ultimoErro);
  throw new Error(mensagem);
}

/**
 * Reconhecimento do alfabeto manual de Libras.
 *
 * O rastreamento vem do MediaPipe Hands (21 pontos da mão) e a classificação
 * do mesmo `libras-recognizer.js` do projeto vanilla, servido de
 * /vendor — são 1.066 linhas de geometria já validadas, e reescrevê-las em
 * TypeScript só traria risco de divergência.
 */
export function useLibras(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  ativo: boolean,
  reconhecer = true,
  calibrar = false,
) {
  const [letra, setLetra] = useState<string | null>(null);
  const [confianca, setConfianca] = useState(0);
  const [emMovimento, setEmMovimento] = useState(false);
  const [palavras, setPalavras] = useState<string[]>([]);
  const [soletrando, setSoletrando] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [maoDetectada, setMaoDetectada] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handsRef = useRef<Hands | null>(null);
  const recRef = useRef<Reconhecedor | null>(null);
  const loopRef = useRef<number | null>(null);
  const pausaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimaLetraRef = useRef<string | null>(null);
  const liberadoRef = useRef(true);
  const quadroRef = useRef<QuadroLandmarks | null>(null);
  const modeloBackendAtivoRef = useRef(false);
  const predicaoBackendRef = useRef<PredicaoBackendEstavel | null>(null);
  const bufferBackendRef = useRef<PredicaoBackendEstavel[]>([]);
  const backendOcupadoRef = useRef(false);
  const backendSolicitadoEmRef = useRef(0);

  /** Desenha os 21 pontos e as conexões da mão sobre o vídeo. */
  const desenhar = useCallback((pontos: Landmark[] | null) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!pontos) return;

    // Dedos: as cadeias de índices que o MediaPipe usa para a mão.
    const dedos = [
      [0, 1, 2, 3, 4],
      [0, 5, 6, 7, 8],
      [0, 9, 10, 11, 12],
      [0, 13, 14, 15, 16],
      [0, 17, 18, 19, 20],
    ];
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    for (const dedo of dedos) {
      ctx.beginPath();
      dedo.forEach((i, ordem) => {
        const p = pontos[i];
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (ordem === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.fillStyle = "#9cd0ce";
    for (const p of pontos) {
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [videoRef]);

  /** Uma letra confirmada só entra de novo depois que a mão sai da pose. */
  const registrarLetra = useCallback((nova: string) => {
    if (LETRAS_BLOQUEADAS.has(nova.toUpperCase())) return;
    if (nova === ultimaLetraRef.current && !liberadoRef.current) return;
    ultimaLetraRef.current = nova;
    liberadoRef.current = false;

    setSoletrando((atual) => atual + nova);
    if (pausaRef.current) clearTimeout(pausaRef.current);
    pausaRef.current = setTimeout(() => {
      setSoletrando((atual) => {
        if (atual) setPalavras((ps) => [...ps, atual]);
        return "";
      });
    }, PAUSA_DE_PALAVRA);
  }, []);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;

    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        if (!temWebGL()) {
          throw new Error(
            "Este navegador não tem aceleração gráfica (WebGL), e o rastreamento da mão travaria a página. Ative a aceleração por hardware nas configurações do navegador.",
          );
        }
        await carregarScriptComRetry(
          `${CDN_MEDIAPIPE}/hands.min.js`,
          () => typeof window.Hands === "function",
          "Não foi possível carregar o rastreamento da mão. Verifique sua conexão e tente novamente.",
        );
        if (reconhecer || calibrar) {
          await carregarScriptComRetry(
            "/vendor/libras-recognizer.js?v=j-gesture-20260827",
            () => typeof window.LibrasAlphabetRecognizer === "function",
            "Não foi possível carregar o reconhecedor de Libras. Tente novamente.",
          );
        }
        if (!vivo) return;

        if (!window.Hands || ((reconhecer || calibrar) && !window.LibrasAlphabetRecognizer)) {
          throw new Error("Rastreamento de mão indisponível.");
        }

        const hands = new window.Hands({ locateFile: (f) => `${CDN_MEDIAPIPE}/${f}` });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.75,
          minTrackingConfidence: 0.75,
        });

        const rec = (reconhecer || calibrar) && window.LibrasAlphabetRecognizer
          ? new window.LibrasAlphabetRecognizer()
          : null;
        recRef.current = rec;
        if (reconhecer && rec) {
          void statusModelo()
            .then((modelo) => {
              if (vivo) modeloBackendAtivoRef.current = modelo.ready;
            })
            .catch(() => {
              modeloBackendAtivoRef.current = false;
            });
        }

        hands.onResults((r) => {
          if (!vivo) return;
          const pontos = r.multiHandLandmarks?.[0] ?? null;
          desenhar(pontos);
          quadroRef.current = pontos
            ? {
                landmarks: pontos.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
                capturadoEm: performance.now(),
              }
            : null;
          setMaoDetectada(Boolean(pontos));

          if (!pontos) {
            rec?.resetTracking();
            bufferBackendRef.current = [];
            predicaoBackendRef.current = null;
            setLetra(null);
            setEmMovimento(false);
            liberadoRef.current = true; // mão saiu: libera repetir a letra
            return;
          }

          // A tela de treinamento precisa apenas dos landmarks crus. Evitar a
          // classificação aqui reduz trabalho e re-renderizações no celular.
          if (!reconhecer || !rec) return;

          const agora = performance.now();

          // O modelo treinado no backend complementa as regras geométricas
          // locais. A cadência e a janela de estabilidade vêm do fluxo HTML:
          // no máximo uma chamada por 135 ms e quatro votos em sete quadros.
          if (
            modeloBackendAtivoRef.current &&
            !backendOcupadoRef.current &&
            agora - backendSolicitadoEmRef.current >= 135
          ) {
            backendOcupadoRef.current = true;
            backendSolicitadoEmRef.current = agora;
            void inferirLandmarks(pontos)
              .then((predicao) => {
                if (!vivo) return;
                if (
                  predicao.unknown ||
                  !predicao.letter ||
                  LETRAS_BLOQUEADAS.has(predicao.letter.toUpperCase())
                ) {
                  bufferBackendRef.current = [];
                  predicaoBackendRef.current = null;
                  return;
                }

                const recebida = {
                  letter: predicao.letter,
                  confidence: predicao.confidence,
                  recebidaEm: performance.now(),
                };
                const buffer = [...bufferBackendRef.current, recebida].slice(-7);
                bufferBackendRef.current = buffer;
                const iguais = buffer.filter((item) => item.letter === recebida.letter);
                if (iguais.length >= 4) {
                  predicaoBackendRef.current = {
                    letter: recebida.letter,
                    confidence:
                      iguais.reduce((soma, item) => soma + item.confidence, 0) / iguais.length,
                    recebidaEm: recebida.recebidaEm,
                  };
                }
              })
              .catch(() => {
                // A classificação local continua funcionando sem rede.
              })
              .finally(() => {
                backendOcupadoRef.current = false;
              });
          }

          const local = rec.process(pontos, agora);
          const neural = predicaoBackendRef.current;
          const saidaBruta: Resultado =
            neural &&
            agora - neural.recebidaEm <= 700 &&
            !local.dynamic &&
            !local.motion?.moving
              ? {
                  status: "confirmado",
                  letter: neural.letter,
                  confidence: neural.confidence,
                  motion: local.motion,
                }
              : local;
          // Defesa final para aparelhos que ainda estejam com pesos ou o
          // reconhecedor antigo na memoria do PWA.
          const saida: Resultado =
            saidaBruta.letter && LETRAS_BLOQUEADAS.has(saidaBruta.letter.toUpperCase())
              ? { status: "incerto", motion: saidaBruta.motion }
              : saidaBruta;
          setEmMovimento(Boolean(saida.motion?.moving));

          if (saida.status === "confirmado" && saida.letter) {
            setLetra(saida.letter);
            setConfianca(saida.confidence ?? 0);
            registrarLetra(saida.letter);
          } else if (saida.status === "estabilizando" && saida.letter) {
            setLetra(saida.letter);
            setConfianca(saida.confidence ?? 0);
          } else if (saida.status === "incerto" || saida.status === "sem-mao") {
            setLetra(null);
            liberadoRef.current = true;
          }
        });

        handsRef.current = hands;
        setCarregando(false);

        // Um quadro por vez: enviar antes do anterior terminar enfileira
        // trabalho e derruba o FPS no celular.
        let ocupado = false;
        const passo = async () => {
          const video = videoRef.current;
          if (vivo && video?.videoWidth && !ocupado) {
            ocupado = true;
            try {
              await hands.send({ image: video });
            } catch {
              /* quadro perdido não interrompe o laço */
            }
            ocupado = false;
          }
          if (vivo) loopRef.current = requestAnimationFrame(passo);
        };
        loopRef.current = requestAnimationFrame(passo);
      } catch (e) {
        if (vivo) {
          setErro((e as Error).message);
          setCarregando(false);
        }
      }
    })();

    return () => {
      vivo = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
      if (pausaRef.current) clearTimeout(pausaRef.current);
      handsRef.current?.close?.();
      handsRef.current = null;
      quadroRef.current = null;
      modeloBackendAtivoRef.current = false;
      predicaoBackendRef.current = null;
      bufferBackendRef.current = [];
    };
  }, [ativo, calibrar, desenhar, reconhecer, registrarLetra, tentativa, videoRef]);

  const frase = [...palavras, soletrando].filter(Boolean).join(" ");

  const apagarUltima = useCallback(() => {
    setSoletrando((atual) => {
      if (atual) return atual.slice(0, -1);
      setPalavras((ps) => ps.slice(0, -1));
      return "";
    });
  }, []);

  const limpar = useCallback(() => {
    setPalavras([]);
    setSoletrando("");
    setLetra(null);
    ultimaLetraRef.current = null;
  }, []);

  const falar = useCallback(() => {
    if (!frase || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(frase);
    fala.lang = "pt-BR";
    speechSynthesis.speak(fala);
  }, [frase]);

  const obterQuadro = useCallback((): QuadroLandmarks | null => {
    const quadro = quadroRef.current;
    if (!quadro) return null;
    return {
      capturadoEm: quadro.capturadoEm,
      landmarks: quadro.landmarks.map((p) => ({ ...p })),
    };
  }, []);

  const tentarNovamente = useCallback(() => {
    setErro(null);
    setTentativa((atual) => atual + 1);
  }, []);

  const adicionarAmostraCalibracao = useCallback((letraAlvo: string, landmarks: Landmark[]) => {
    const reconhecedor = recRef.current;
    if (!reconhecedor) {
      throw new Error("A calibração local de Libras ainda não está pronta.");
    }
    return reconhecedor.addCalibrationSample(letraAlvo, landmarks);
  }, []);

  const finalizarCalibracao = useCallback(() => {
    const reconhecedor = recRef.current;
    if (!reconhecedor) {
      throw new Error("A calibração local de Libras ainda não está pronta.");
    }
    reconhecedor.finishCalibration();
  }, []);

  return {
    canvasRef,
    maoDetectada,
    obterQuadro,
    letra,
    confianca,
    emMovimento,
    frase,
    soletrando,
    carregando,
    erro,
    tentarNovamente,
    adicionarAmostraCalibracao,
    finalizarCalibracao,
    apagarUltima,
    limpar,
    falar,
  };
}
