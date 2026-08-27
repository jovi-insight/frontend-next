"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const CHAVE_DISPENSADO = "jovi_pwa_prompt_dismissed";

export default function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [exibir, setExibir] = useState(false);
  const [isIos, setIsIos] = useState(false);
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
      setIsIos(true);
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
    if (isIos) {
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
      aria-label="Recomendação de Instalação do App"
      style={{
        position: "fixed",
        top: "calc(16px + env(safe-area-inset-top, 0px))",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: 440,
        zIndex: 10000,
        background: "rgba(24, 24, 28, 0.94)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(156, 208, 206, 0.35)",
        borderRadius: 20,
        padding: "16px 18px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.65), 0 0 24px rgba(94, 92, 230, 0.2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192x192.png"
          alt="Ícone do JOVI"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <strong style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>
              Instale o App JOVI
            </strong>
            <button
              type="button"
              onClick={dispensar}
              aria-label="Fechar"
              style={{
                background: "none",
                border: "none",
                color: "var(--on-surface-variant)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                close
              </span>
            </button>
          </div>

          <p
            style={{
              fontSize: 12,
              color: "var(--on-surface-variant)",
              marginTop: 3,
              marginBottom: 12,
              lineHeight: 1.4,
            }}
          >
            Acesse a câmera, resumos e cadernos com maior velocidade e em tela cheia.
          </p>

          {guiaIos ? (
            <div
              style={{
                background: "rgba(94, 92, 230, 0.15)",
                border: "1px solid rgba(156, 208, 206, 0.3)",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 11,
                lineHeight: 1.5,
                color: "#9cd0ce",
              }}
            >
              Toque no ícone de <strong>Compartilhar</strong> no Safari e selecione{" "}
              <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={instalar}
                style={{
                  background: "var(--primary)",
                  color: "var(--on-primary)",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  download
                </span>
                Instalar agora
              </button>

              <button
                type="button"
                onClick={dispensar}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "var(--on-surface)",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
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
