"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GuardaSessao from "@/components/GuardaSessao";
import BottomNav from "@/components/BottomNav";
import { PERFIS, alternarPerfil, lerPerfis, CHAVE_PERFIL, gravarPerfis } from "@/lib/perfil";
import {
  useLocalStorage,
  gravarLocalStorage,
  removerLocalStorage,
} from "@/lib/use-local-storage";
import { avisar } from "@/lib/avisos";

const URL_LIBRAS_PADRAO = "http://localhost:8001";

function SettingsConteudo() {
  const router = useRouter();
  // Lidos direto do localStorage: sem useEffect + setState, que renderizaria
  // a tela duas vezes a cada visita.
  const perfilSalvo = useLocalStorage(CHAVE_PERFIL);
  const urlSalva = useLocalStorage("jovi.libras.ml.url", URL_LIBRAS_PADRAO);

  // Só o campo de texto precisa de estado próprio: ele é editável antes de
  // salvar. `key` faz o input renascer quando o valor salvo muda.
  const [urlLibras, setUrlLibras] = useState(urlSalva);
  const [salvo, setSalvo] = useState(false);
  const perfis = lerPerfis(perfilSalvo);

  function alternar(id: (typeof PERFIS)[number]["id"]) {
    const novos = alternarPerfil(perfis, id);
    const perfil = PERFIS.find((p) => p.id === id)!;
    avisar(
      novos.includes(id) ? `Perfil ativado: ${perfil.nome}` : `Perfil desativado: ${perfil.nome}`,
      "sucesso",
    );
  }

  function limparPerfis() {
    gravarPerfis([]);
    avisar("Interface padrão, sem adaptações.", "sucesso");
  }

  function salvarLibras() {
    gravarLocalStorage("jovi.libras.ml.url", urlLibras.replace(/\/$/, ""));
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  function sair() {
    if (!confirm("Deseja realmente encerrar a sessão?")) return;
    removerLocalStorage("jovi_session");
    removerLocalStorage("jovi_user");
    router.replace("/login");
  }

  return (
    <>

      <main className="container archive-main sem-topbar">
        <div className="section-header">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>Conta e Armazenamento</h2>
          </div>
        </div>

        <div className="card flex items-center justify-between" style={{ marginBottom: 40 }}>
          <div className="flex items-center gap-4">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined">cloud</span>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700 }}>Supabase Storage</p>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--on-surface-variant)",
                }}
              >
                Conectado como: academic_user_04
              </p>
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--primary)",
              textTransform: "uppercase",
            }}
          >
            Ativo
          </span>
        </div>

        <div className="section-header">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>Acessibilidade</h2>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginBottom: 20 }}>
          Marque quantas opções precisar — elas se somam. O perfil muda como o app se comporta:
          tamanho do texto, contraste e por qual tela os resumos abrem.
        </p>

        <fieldset
          style={{
            border: 0,
            padding: 0,
            margin: "0 0 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <legend className="sr-only">Perfis de acessibilidade</legend>
          {PERFIS.map((p) => {
            const ativo = perfis.includes(p.id);
            return (
              <label
                key={p.id}
                className={`perfil-opcao${ativo ? " selecionado" : ""}`}
                style={{ cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={() => alternar(p.id)}
                  style={{ width: 20, height: 20, accentColor: "var(--primary)", flexShrink: 0 }}
                />
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                  {p.icone}
                </span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <strong style={{ display: "block", fontSize: 13 }}>{p.nome}</strong>
                  <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
                    {p.descricao}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div style={{ marginBottom: 40 }}>
          <button
            type="button"
            className="link-limpo text-primary"
            onClick={limparPerfis}
            disabled={perfis.length === 0}
          >
            {perfis.length === 0
              ? "Nenhuma adaptação ativa (interface padrão)"
              : `Desativar todas (${perfis.length})`}
          </button>
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
          Terminar Sessão Operativa
        </button>

        <section
          style={{
            textAlign: "center",
            opacity: 0.4,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 48,
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            JOVI | Edge-to-Cloud Intelligence
          </p>
          <p style={{ fontFamily: "monospace", fontSize: 8 }}>Build V.1.0.4-academic</p>
        </section>
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
