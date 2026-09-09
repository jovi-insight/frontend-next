"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Worker } from "tesseract.js";
import { criarLeitorMatematico } from "./matematica-ocr";
import type { SolucaoMatematica } from "./matematica";
import type { PedidoMatematico } from "./matematica-avancada";
import { MotorMatematico } from "./matematica-motor";
import { confirmarLeitura, diferencaQuadros, recorteCamera, type ConsensoMatematico } from "./matematica-leitura";

type Estado = "preparando" | "buscando" | "conferindo" | "resultado" | "erro";
type Leitura = { estado: Estado; mensagem: string; progresso: number; solucao: SolucaoMatematica | null; tempoMs: number | null };
const INICIAL: Leitura = { estado: "preparando", mensagem: "Preparando o leitor no aparelho…", progresso: 0, solucao: null, tempoMs: null };

export function useMatematica(
  videoRef: RefObject<HTMLVideoElement | null>, molduraRef: RefObject<HTMLDivElement | null>,
  pronta: boolean, zoom: number, pausada: boolean, opcoes: Omit<PedidoMatematico, "expressao">,
) {
  const [leitura, setLeitura] = useState<Leitura>(INICIAL);
  const [tentativa, setTentativa] = useState(0);
  const pausadaRef = useRef(pausada);
  const cameraRef = useRef({ pronta, zoom });
  const opcoesRef = useRef(opcoes);
  const motorRef = useRef<MotorMatematico | null>(null);
  const fotoRef = useRef<(() => Promise<Blob | null>) | null>(null);
  useEffect(() => { pausadaRef.current = pausada; }, [pausada]);
  useEffect(() => { cameraRef.current = { pronta, zoom }; }, [pronta, zoom]);
  useEffect(() => { opcoesRef.current = opcoes; }, [opcoes]);

  useEffect(() => {
    let encerrado = false, ocupada = false, geracao = 0;
    let worker: Worker | null = null, timer: ReturnType<typeof setInterval> | null = null;
    let timeoutInicial: ReturnType<typeof setTimeout> | null = null;
    let candidato: ConsensoMatematico | null = null;
    let chaveConfirmada: string | null = null;
    let referencia: Uint8Array | null = null;
    let ultimoSucesso: Uint8Array | null = null;
    let inicioCena = performance.now(), ultimoOCR = 0;
    let suspensa = false;
    let configuracao = JSON.stringify(opcoesRef.current);
    const motor = new MotorMatematico();
    motorRef.current = motor;
    const canvas = document.createElement("canvas");
    const mini = document.createElement("canvas");
    mini.width = 96; mini.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const miniCtx = mini.getContext("2d", { willReadFrequently: true });
    const atualizar = (dados: Partial<Leitura>) => {
      if (!encerrado) setLeitura((antes) => ({ ...antes, ...dados }));
    };
    const invalidar = () => {
      geracao++; candidato = null; chaveConfirmada = null; ultimoSucesso = null; referencia = null;
      inicioCena = performance.now();
      atualizar({ estado: "buscando", mensagem: "Enquadre uma conta inteira em uma linha.", solucao: null, tempoMs: null });
    };
    function capturar(): Uint8Array | null {
      const video = videoRef.current, moldura = molduraRef.current;
      if (!ctx || !miniCtx || !video?.videoWidth || !moldura || video.readyState < 2) return null;
      // clientWidth/Height ignoram o transform:scale do zoom. O recorte aplica-o uma só vez.
      const box = video.getBoundingClientRect(), frame = moldura.getBoundingClientRect();
      const cssZoom = cameraRef.current.zoom;
      const visor = { width: box.width / cssZoom, height: box.height / cssZoom };
      const left = box.left + (box.width - visor.width) / 2;
      const top = box.top + (box.height - visor.height) / 2;
      const recorte = recorteCamera({ width: video.videoWidth, height: video.videoHeight }, visor, {
        x: frame.left - left, y: frame.top - top, width: frame.width, height: frame.height,
      }, cssZoom);
      if (recorte.width <= 0 || recorte.height <= 0) return null;
      const largura = Math.min(960, Math.round(recorte.width * 2));
      const altura = Math.round(largura * recorte.height / recorte.width);
      if (canvas.width !== largura || canvas.height !== altura) { canvas.width = largura; canvas.height = altura; }
      try {
        ctx.drawImage(video, recorte.x, recorte.y, recorte.width, recorte.height, 0, 0, largura, altura);
      } catch { return null; } // Troca de câmera/stream entre dois frames.
      miniCtx.drawImage(canvas, 0, 0, mini.width, mini.height);
      const dados = miniCtx.getImageData(0, 0, mini.width, mini.height).data;
      const assinatura = new Uint8Array(mini.width * mini.height);
      for (let i = 0; i < assinatura.length; i++) assinatura[i] = Math.round((dados[i * 4] + dados[i * 4 + 1] + dados[i * 4 + 2]) / 3);
      return assinatura;
    }
    fotoRef.current = () => new Promise((resolve) => {
      if (!capturar()) { resolve(null); return; }
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    async function reconhecer(assinatura: Uint8Array, versao: number) {
      if (!worker || !ctx) return;
      ocupada = true;
      ultimoOCR = performance.now();
      // Snapshot separado: o monitor de movimento não pode sobrescrever a imagem em voo.
      const snapshot = document.createElement("canvas");
      snapshot.width = canvas.width; snapshot.height = canvas.height;
      snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
      let prazo: ReturnType<typeof setTimeout> | undefined;
      try {
        const resposta = await Promise.race([
          worker.recognize(snapshot, {}, { text: true, blocks: true }),
          new Promise<never>((_, reject) => { prazo = setTimeout(() => reject(new Error("Leitura demorou demais.")), 8000); }),
        ]);
        if (encerrado || versao !== geracao || pausadaRef.current || document.hidden) return;
        const atual = capturar();
        if (!atual || diferencaQuadros(assinatura, atual) > 0.025) { invalidar(); return; }
        const texto = resposta.data.text.trim();
        const linhas = (resposta.data.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
        const cortada = linhas.some((linha) => linha.bbox.x0 < 4 || linha.bbox.y0 < 3 ||
          linha.bbox.x1 > snapshot.width - 4 || linha.bbox.y1 > snapshot.height - 3);
        const pedido = { ...opcoesRef.current, expressao: texto };
        const configuracaoDaLeitura = JSON.stringify(opcoesRef.current);
        const analise = await motor.resolver(pedido);
        if (encerrado || versao !== geracao || pausadaRef.current || document.hidden) return;
        if (configuracaoDaLeitura !== JSON.stringify(opcoesRef.current)) return;
        const depoisDoCalculo = capturar();
        if (!depoisDoCalculo || diferencaQuadros(assinatura, depoisDoCalculo) > 0.025) { invalidar(); return; }
        if (!analise.ok || cortada || linhas.length > 1) {
          candidato = null; chaveConfirmada = null; ultimoSucesso = null;
          atualizar({ estado: "buscando", solucao: null, tempoMs: null,
            mensagem: cortada ? "A conta está cortada. Afaste um pouco a câmera." :
              !texto ? "Aponte para uma conta impressa, com boa luz." : !analise.ok ? analise.motivo : "Enquadre uma única linha." });
          return;
        }
        const chave = analise.solucao.expressao.replace(/\s/g, "");
        if (chave === chaveConfirmada && resposta.data.confidence >= 45) {
          ultimoSucesso = assinatura;
          return; // Não pisca nem aumenta artificialmente o tempo de uma resposta já exibida.
        }
        chaveConfirmada = null;
        const consenso = confirmarLeitura(candidato, analise.solucao.expressao, resposta.data.confidence, performance.now());
        candidato = consenso.candidato;
        if (!consenso.confirmado) {
          atualizar({ estado: "conferindo", solucao: null, tempoMs: null,
            mensagem: candidato ? "Conferindo a expressão…" : "Leitura incerta. Aproxime e mantenha a câmera firme." });
          return;
        }
        ultimoSucesso = assinatura;
        chaveConfirmada = chave;
        atualizar({ estado: "resultado", solucao: analise.solucao, mensagem: "Confira se a expressão lida é a sua conta.",
          tempoMs: Math.round(performance.now() - inicioCena) });
      } catch {
        if (!encerrado) {
          if (timer) clearInterval(timer);
          atualizar({ estado: "erro", solucao: null, tempoMs: null, mensagem: "O leitor parou. Tente novamente ou digite a conta." });
          void worker?.terminate(); worker = null;
        }
      } finally { clearTimeout(prazo); ocupada = false; }
    }
    function observar() {
      if (encerrado) return;
      if (pausadaRef.current || document.hidden || !cameraRef.current.pronta) {
        if (!suspensa) { invalidar(); suspensa = true; }
        return;
      }
      if (suspensa) { invalidar(); suspensa = false; }
      const novaConfiguracao = JSON.stringify(opcoesRef.current);
      if (novaConfiguracao !== configuracao) { configuracao = novaConfiguracao; invalidar(); }
      const assinatura = capturar();
      if (!assinatura) { if (chaveConfirmada) invalidar(); return; }
      if (diferencaQuadros(referencia, assinatura) > 0.025) {
        invalidar(); referencia = assinatura;
      }
      // Releitura periódica mesmo sem movimento aparente: trocar só um sinal
      // ou expoente pode afetar poucos pixels da imagem.
      if (ultimoSucesso && diferencaQuadros(ultimoSucesso, assinatura) <= 0.012 && performance.now() - ultimoOCR < 900) return;
      if (ocupada || performance.now() - ultimoOCR < 160) return;
      void reconhecer(assinatura, geracao);
    }
    async function iniciar() {
      atualizar(INICIAL);
      // Não deixar o download inicial prender a interface indefinidamente.
      timeoutInicial = setTimeout(() => {
        if (worker || encerrado) return;
        encerrado = true;
        setLeitura({ ...INICIAL, estado: "erro", mensagem: "Não foi possível carregar o leitor. Confira a conexão e tente novamente." });
      }, 30000);
      try {
        const criado = await criarLeitorMatematico((progresso) => atualizar({ progresso }));
        if (encerrado) { await criado.terminate(); return; }
        worker = criado;
        clearTimeout(timeoutInicial);
        invalidar();
        timer = setInterval(observar, 100);
        observar();
      } catch {
        clearTimeout(timeoutInicial);
        atualizar({ estado: "erro", mensagem: "Não foi possível carregar o leitor. Confira a conexão e tente novamente." });
      }
    }
    void iniciar();
    return () => {
      encerrado = true; geracao++;
      if (timer) clearInterval(timer);
      if (timeoutInicial) clearTimeout(timeoutInicial);
      void worker?.terminate();
      motor.encerrar(); motorRef.current = null; fotoRef.current = null;
    };
  }, [videoRef, molduraRef, tentativa]);

  return { ...leitura,
    capturarFormula: () => fotoRef.current?.() ?? Promise.resolve(null),
    calcular: (pedido: PedidoMatematico) => motorRef.current?.resolver(pedido) ?? Promise.resolve({ ok: false as const, motivo: "Preparando o motor…" }),
    tentarNovamente: () => setTentativa((n) => n + 1),
  };
}
