"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GuardaSessao from "@/components/GuardaSessao";
import TopHeader from "@/components/TopHeader";
import BottomNav from "@/components/BottomNav";
import { PERFIS, aplicarPerfil, CHAVE_PERFIL, type PerfilId } from "@/lib/perfil";
import {
  useLocalStorage,
  gravarLocalStorage,
  removerLocalStorage,
} from "@/lib/use-local-storage";

const URL_LIBRAS_PADRAO = "http://localhost:8001";

function SettingsConteudo() {
  const router = useRouter();
  // Lidos direto do localStorage: sem useEffect + setState, que renderizaria
  // a tela duas vezes a cada visita.
  const perfilSalvo = useLocalStorage(CHAVE_PERFIL, "padrao") as PerfilId;
  const urlSalva = useLocalStorage("jovi.libras.ml.url", URL_LIBRAS_PADRAO);

  // Só o campo de texto precisa de estado próprio: ele é editável antes de
  // salvar. `key` faz o input renascer quando o valor salvo muda.
  const [urlLibras, setUrlLibras] = useState(urlSalva);
  const [salvo, setSalvo] = useState(false);
  const perfil = PERFIS.some((p) => p.id === perfilSalvo) ? perfilSalvo : "padrao";

  function escolher(id: PerfilId) {
    aplicarPerfil(id); // grava e notifica quem lê com useLocalStorage
  }

  function salvarLibras() {
    gravarLocalStorage("jovi.libras.ml.url", urlLibras.replace(/\/$/, ""));
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  function sair() {
    removerLocalStorage("jovi_session");
    router.replace("/login");
  }

  return (
    <>
      <TopHeader titulo="Settings" />

      <main className="container archive-main">
        <div className="section-header">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>Acessibilidade</h2>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginBottom: 20 }}>
          O perfil muda como o app se comporta: tamanho do texto, contraste e por qual tela os
          resumos abrem.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
          {PERFIS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`perfil-opcao${perfil === p.id ? " selecionado" : ""}`}
              aria-pressed={perfil === p.id}
              onClick={() => escolher(p.id)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                {p.icone}
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <strong style={{ display: "block", fontSize: 13 }}>{p.nome}</strong>
                <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
                  {p.descricao}
                </span>
              </span>
              {perfil === p.id && (
                <span className="material-symbols-outlined text-primary">check_circle</span>
              )}
            </button>
          ))}
        </div>

        <div className="section-header">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>Microserviço de Libras</h2>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginBottom: 12 }}>
          Endereço do serviço que transcreve vídeos e reconhece o alfabeto manual. Só mude se ele
          estiver em outra máquina ou porta.
        </p>

        <div className="quiz-controles" style={{ marginBottom: 40 }}>
          <input
            className="form-input"
            value={urlLibras}
            onChange={(e) => setUrlLibras(e.target.value)}
            placeholder="http://localhost:8001"
            aria-label="URL do microserviço de Libras"
            style={{ flex: 1, minWidth: 220 }}
          />
          <button type="button" className="quiz-gerar" onClick={salvarLibras}>
            {salvo ? "Salvo" : "Salvar"}
          </button>
        </div>

        <div className="section-header">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>Sessão</h2>
          </div>
        </div>

        <button
          type="button"
          className="quiz-gerar"
          onClick={sair}
          style={{ background: "var(--error)", color: "var(--on-error)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            logout
          </span>
          Sair da conta
        </button>
      </main>

      <BottomNav />
    </>
  );
}

export default function SettingsPage() {
  return (
    <GuardaSessao>
      <SettingsConteudo />
    </GuardaSessao>
  );
}
