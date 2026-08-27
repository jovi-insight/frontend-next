"use client";

import Link from "next/link";
import GuardaSessao from "@/components/GuardaSessao";
import BottomNav from "@/components/BottomNav";
import { PERFIS, alternarPerfil, lerPerfis, CHAVE_PERFIL, gravarPerfis } from "@/lib/perfil";
import { useLocalStorage } from "@/lib/use-local-storage";
import { avisar } from "@/lib/avisos";

function SettingsConteudo() {
  // Lidos direto do localStorage: sem useEffect + setState, que renderizaria
  // a tela duas vezes a cada visita.
  const perfilSalvo = useLocalStorage(CHAVE_PERFIL);
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
              <span className="material-symbols-outlined">add_to_drive</span>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700 }}>Google Drive integrado</p>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--on-surface-variant)",
                }}
              >
                Conteúdos sincronizados com segurança
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
            Integrado
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

        <Link href="/libras-training" className="ajustes-treino-libras">
          <span className="ajustes-treino-libras-icone material-symbols-outlined" aria-hidden="true">
            model_training
          </span>
          <span>
            <strong>Treinar modelo de Libras</strong>
            <small>Capture os 21 pontos da mão e ensine novas letras ao INSIGHT.</small>
          </span>
          <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </Link>

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
            <h2>Integrações</h2>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 40 }}>
          <div className="flex items-center gap-4">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(255,214,0,0.12)",
                color: "var(--primary)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined">cloud_done</span>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700 }}>INSIGHT + Google Drive</p>
              <p style={{ fontSize: 11, color: "var(--on-surface-variant)", lineHeight: 1.5 }}>
                Imagens, textos e resumos entram no fluxo de sincronização do Drive ao salvar.
                Vídeos ficam disponíveis no banco e também no aparelho para uso offline.
              </p>
            </div>
          </div>
        </div>

        <div className="section-header">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>Aplicativo no Dispositivo (PWA)</h2>
          </div>
        </div>

        <div
          className="card flex items-center justify-between"
          style={{ marginBottom: 40, flexWrap: "wrap", gap: 16 }}
        >
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192x192.png"
              alt="Ícone do INSIGHT"
              style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}
            />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700 }}>Instalar INSIGHT</p>
              <p style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
                Tela cheia, cache offline, flash e gesto vertical de zoom direto na câmera.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="chip chip-primario"
            onClick={() => {
              localStorage.removeItem("jovi_pwa_prompt_dismissed");
              window.location.reload();
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              install_mobile
            </span>
            Instalar / Atualizar App
          </button>
        </div>

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
            INSIGHT | Capture, estude e evolua
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
