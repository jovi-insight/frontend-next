"use client";

import { useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const CHAVE_DISPENSADO = "jovi_pwa_prompt_dismissed";

export default function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [exibir, setExibir] = useState(false);
  const isIosRef = useRef(false);
  const [guiaIos, setGuiaIos] = useState(false);

  useEffect(() => {
    // Se já estiver rodando como PWA (instalado), não mostra nada
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    // Se o usuário dispensou recentemente (nas últimas 24h), não insiste
    const dispensadoEm = localStorage.getItem(CHAVE_DISPENSADO);
    if (dispensadoEm) {
      const passadoMs = Date.now() - Number(dispensadoEm);
      if (passadoMs < 24 * 60 * 60 * 1000) return;
    }

    // Detecção de iOS / iPadOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleMobile =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isAppleMobile) {
      isIosRef.current = true;
      // No iOS exibe após 3 segundos de navegação
      const timer = setTimeout(() => setExibir(true), 3000);
      return () => clearTimeout(timer);
    }

    // Navegadores Chromium / Android
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setExibir(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  function dispensar() {
    setExibir(false);
    setGuiaIos(false);
    localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()));
  }

  async function instalar() {
    if (isIosRef.current) {
      setGuiaIos(true);
      return;
    }

    if (!promptEvent) return;

    await promptEvent.prompt();
    const escolha = await promptEvent.userChoice;
    if (escolha.outcome === "accepted") {
      setExibir(false);
    }
  }

  if (!exibir) return null;

  return (
    <aside
      className="pwa-install-card"
      aria-label="Recomendação de Instalação do App"
    >
      <div className="pwa-install-layout">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192x192.png"
          alt="Ícone do INSIGHT"
          className="pwa-install-icon"
        />

        <div className="pwa-install-content">
          <div className="pwa-install-header">
            <strong>Instale o App INSIGHT</strong>
            <button
              type="button"
              onClick={dispensar}
              aria-label="Fechar"
              className="pwa-install-close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <p className="pwa-install-copy">
            Acesse a câmera, resumos e cadernos com maior velocidade e em tela cheia.
          </p>

          {guiaIos ? (
            <div className="pwa-install-ios-guide">
              Toque no ícone de <strong>Compartilhar</strong> no Safari e selecione{" "}
              <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
            </div>
          ) : (
            <div className="pwa-install-actions">
              <button
                type="button"
                onClick={instalar}
                className="pwa-install-primary"
              >
                <span className="material-symbols-outlined">download</span>
                Instalar agora
              </button>

              <button
                type="button"
                onClick={dispensar}
                className="pwa-install-secondary"
              >
                Agora não
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
