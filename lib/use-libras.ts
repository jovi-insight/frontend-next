"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inferirLandmarks, statusModelo } from "./libras-ml";
import {
  combinarLeituras,
  consensoNeural,
  EstabilizadorLibras,
  mesmaPose,
  orientacaoEnquadramento,
  type LeituraLibras,
  type PredicaoTemporal,
} from "./libras-estabilidade";

// Só separa palavras quando a mão fica fora da câmera, não no meio da soletração.
const PAUSA_DE_PALAVRA = 2000;

const VERSAO_MEDIAPIPE = "0.4.1675469240";
const CDN_MEDIAPIPE = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${VERSAO_MEDIAPIPE}`;
const scriptsCarregando = new Map<string, Promise<void>>();

export type Landmark = { x: number; y: number; z: number };

export type QuadroLandmarks = {
  landmarks: Landmark[];
  capturadoEm: number;
};

type Reconhecedor = {
  process: (landmarks: Landmark[], agora: number) => LeituraLibras;
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
  const [texto, setTexto] = useState("");
  const [estadoLeitura, setEstadoLeitura] = useState<LeituraLibras["status"]>("sem-mao");
  const [progressoLeitura, setProgressoLeitura] = useState(0);
  const [orientacao, setOrientacao] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [maoDetectada, setMaoDetectada] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handsRef = useRef<Hands | null>(null);
  const recRef = useRef<Reconhecedor | null>(null);
  const loopRef = useRef<number | null>(null);
  const pausaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estabilizadorRef = useRef(new EstabilizadorLibras());
  const quadroRef = useRef<QuadroLandmarks | null>(null);

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

  // O estabilizador já impede repetição por tremor ou perda momentânea da mão.
  const registrarLetra = useCallback((nova: string) => {
    setTexto((atual) => atual + nova);
  }, []);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    let classesModelo = new Set<string>();
    let predicoes: PredicaoTemporal[] = [];
    let consulta: AbortController | null = null;
    let solicitadoEm = -Infinity;
    estabilizadorRef.current.resetar();

    function apresentar(leitura: LeituraLibras, agora: number) {
      const estavel = estabilizadorRef.current.processar(leitura, agora);
      setLetra(estavel.letra);
      setConfianca(estavel.confianca);
      setEstadoLeitura(estavel.estado);
      setProgressoLeitura(Math.round(estavel.progresso * 20) / 20);
      setEmMovimento(Boolean(leitura.motion?.moving));
      if (estavel.registrar) registrarLetra(estavel.registrar);
    }

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
            "/vendor/libras-recognizer.js?v=estabilidade-v3-20260906",
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
              if (vivo && modelo.ready) classesModelo = new Set(modelo.classes);
            })
            .catch(() => undefined);
        }

        hands.onResults((r) => {
          if (!vivo) return;
          const agora = performance.now();
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
            predicoes = [];
            consulta?.abort();
            setOrientacao(null);
            if (reconhecer) {
              apresentar({ status: "sem-mao" }, agora);
              if (!pausaRef.current) {
                pausaRef.current = setTimeout(() => {
                  if (vivo) setTexto((atual) => atual.trimEnd() ? `${atual.trimEnd()} ` : "");
                }, PAUSA_DE_PALAVRA);
              }
            }
            return;
          }
          if (pausaRef.current) {
            clearTimeout(pausaRef.current);
            pausaRef.current = null;
          }

          // A tela de treinamento precisa apenas dos landmarks crus. Evitar a
          // classificação aqui reduz trabalho e re-renderizações no celular.
          if (!reconhecer || !rec) return;

          const enquadramento = orientacaoEnquadramento(pontos);
          setOrientacao(enquadramento);
          if (enquadramento) {
            rec.resetTracking();
            predicoes = [];
            consulta?.abort();
            apresentar({ status: "incerto" }, agora);
            return;
          }
          const local = rec.process(pontos, agora);
          predicoes = predicoes.filter((item) => agora - item.capturadoEm <= 900 && mesmaPose(item.pontos, pontos));
          if (local.motion?.moving || local.dynamic) predicoes = [];

          // Vota somente em capturas recentes da mesma pose. Uma resposta lenta
          // não pode ser tratada como se fosse a mão que está na câmera agora.
          if (
            classesModelo.size && !consulta && agora - solicitadoEm >= 250 &&
            !local.motion?.moving && !local.dynamic &&
            (!local.letter || classesModelo.has(local.letter))
          ) {
            const controle = new AbortController();
            consulta = controle;
            solicitadoEm = agora;
            const captura = pontos.map((p) => ({ ...p }));
            const limite = setTimeout(() => controle.abort(), 1200);
            void inferirLandmarks(captura, controle.signal)
              .then((predicao) => {
                const atual = quadroRef.current;
                if (!vivo || controle.signal.aborted || !atual || performance.now() - agora > 650 ||
                  !mesmaPose(captura, atual.landmarks)) return;
                if (predicao.unknown || !predicao.letter || !classesModelo.has(predicao.letter)) {
                  predicoes = [];
                  return;
                }
                predicoes = [...predicoes, {
                  letter: predicao.letter, confidence: predicao.confidence,
                  capturadoEm: agora, pontos: captura,
                }].slice(-5);
              })
              .catch(() => {
                // A classificação local continua funcionando sem rede.
              })
              .finally(() => {
                clearTimeout(limite);
                if (consulta === controle) consulta = null;
              });
          }
          apresentar(combinarLeituras(local, consensoNeural(predicoes, agora), pontos, agora), agora);
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
      pausaRef.current = null;
      consulta?.abort();
      handsRef.current?.close?.();
      handsRef.current = null;
      quadroRef.current = null;
    };
  }, [ativo, calibrar, desenhar, reconhecer, registrarLetra, tentativa, videoRef]);

  const frase = texto.trim();
  const soletrando = texto.split(" ").at(-1) ?? "";

  const apagarUltima = useCallback(() => {
    setTexto((atual) => atual.trimEnd().slice(0, -1));
  }, []);

  const espaco = useCallback(() => {
    setTexto((atual) => atual.trimEnd() ? `${atual.trimEnd()} ` : "");
    estabilizadorRef.current.resetar();
  }, []);

  const limpar = useCallback(() => {
    setTexto("");
    setLetra(null);
    estabilizadorRef.current.resetar();
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
    estadoLeitura,
    progressoLeitura,
    orientacao,
    frase,
    soletrando,
    carregando,
    erro,
    tentarNovamente,
    adicionarAmostraCalibracao,
    finalizarCalibracao,
    apagarUltima,
    espaco,
    limpar,
    falar,
  };
}
