"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import GuardaSessao from "@/components/GuardaSessao";
import TopHeader from "@/components/TopHeader";
import BottomNav from "@/components/BottomNav";
import Quiz from "@/components/Quiz";
import { getConteudo, gerarResumo, isUuid, type Conteudo } from "@/lib/api";
import { gravarLocalStorage, useLocalStorage } from "@/lib/use-local-storage";
import { CHAVE_PERFIL } from "@/lib/perfil";

function SummaryConteudo({ id }: { id: string }) {
  const [doc, setDoc] = useState<Conteudo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const router = useRouter();
  const perfil = useLocalStorage(CHAVE_PERFIL, "padrao");
  // O Modo Foco volta com ?voltando=1 — sem isso, sair de lá cairia aqui e
  // seria mandado de volta para o Foco, num laço sem saída.
  const voltando = useSearchParams().get("voltando") === "1";

  // Perfil dislexia/TDAH entra direto no Modo Foco, antes de a tela densa
  // aparecer: mostrar o texto completo por um instante e só então arrancar o
  // usuário dali é exatamente a carga cognitiva que o perfil evita.
  // Só com o resumo pronto — no texto bruto da OCR, o Foco leria o despejo.
  const irParaFoco = perfil === "dislexia-tdah" && !voltando && Boolean(doc?.resumo_ia);

  useEffect(() => {
    if (irParaFoco) router.replace(`/focus/${id}`);
  }, [irParaFoco, id, router]);

  useEffect(() => {
    let ativo = true;
    getConteudo(id)
      .then((d) => {
        if (!ativo) return;
        setDoc(d);
        // O tradutor abre já preenchido com o último documento visto — é assim
        // que as duas telas se conectam, sem estado global.
        gravarLocalStorage("jovi_last_scan_result", JSON.stringify(d));
      })
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [id]);

  async function pedirResumo() {
    setGerando(true);
    setErro(null);
    try {
      const { resumo } = await gerarResumo(id);
      setDoc((antes) => (antes ? { ...antes, resumo_ia: resumo } : antes));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  if (erro && !doc) {
    return (
      <main className="container archive-main">
        <p style={{ color: "var(--error)", fontSize: 13 }}>{erro}</p>
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="container archive-main">
        <div className="loading-container">
          <div className="spinner" />
        </div>
      </main>
    );
  }

  const textoBruto = (doc.extracao_original || "").trim();
  const primeiraLinha = textoBruto.split(/[.!?\n]/)[0].trim();
  const titulo = primeiraLinha.slice(0, 55) + (primeiraLinha.length > 55 ? "..." : "");

  return (
    <>
      <TopHeader titulo="Archive" />

      <main className="container archive-main">
        <nav className="breadcrumb" id="summary-breadcrumb">
          <Link href="/library" style={{ textDecoration: "none", color: "inherit" }}>
            Recents
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            chevron_right
          </span>
          <span className="text-primary">Resumo</span>
        </nav>

        <section className="section-header">
          <div>
            <h2>{titulo || "Documento"}</h2>
            <p
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 2,
                opacity: 0.6,
                marginTop: 16,
              }}
            >
              REF: {doc.id.slice(0, 8).toUpperCase()} ·{" "}
              {new Date(doc.ultima_atualizacao).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </section>

        <div className="summary-grid">
          <section className="summary-content">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                <h3 className="secao-titulo">Conteúdo da Aula</h3>
              </div>
              <button
                type="button"
                className="text-primary"
                onClick={pedirResumo}
                disabled={gerando}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  refresh
                </span>
                {gerando ? "Gerando…" : "Regenerar"}
              </button>
            </div>

            <div className="summary-card" style={{ marginBottom: 24 }}>
              <div className="summary-text" style={{ whiteSpace: "pre-wrap" }}>
                {gerando ? (
                  <span style={{ opacity: 0.6 }}>
                    <span className="spinner" /> Gerando resumo com IA… (leva ~25s)
                  </span>
                ) : (
                  doc.resumo_ia || "(Resumo ainda não gerado — use Regenerar.)"
                )}
              </div>
            </div>

            {erro && (
              <p role="alert" style={{ color: "var(--error)", fontSize: 12, marginBottom: 16 }}>
                {erro}
              </p>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <Link href={`/focus/${doc.id}`} className="quiz-gerar" style={{ textDecoration: "none" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  center_focus_strong
                </span>
                Modo Foco
              </Link>
              <Link href="/translate" className="video-toggle-btn" style={{ textDecoration: "none" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  g_translate
                </span>
                Traduzir
              </Link>
            </div>

            <details style={{ marginBottom: 28, border: "1px solid rgba(72,72,72,0.2)", borderRadius: 16, overflow: "hidden" }}>
              <summary
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "16px 20px",
                  cursor: "pointer",
                  background: "var(--surface-container-low)",
                  userSelect: "none",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--primary)" }}>
                  article
                </span>
                <span className="secao-titulo" style={{ flex: 1 }}>
                  Texto extraído (OCR)
                </span>
              </summary>
              <div style={{ padding: 20, background: "var(--surface-container-low)" }}>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.9,
                    color: "var(--on-surface-variant)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  {textoBruto}
                </p>
              </div>
            </details>
          </section>

          <aside className="summary-aside">
            {doc.imagens?.[0] && (
              <section>
                <div className="flex items-center gap-3">
                  <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                  <h3 className="secao-titulo">Original</h3>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doc.imagens[0].url_storage}
                  alt="Imagem original do documento"
                  className="doc-original-image"
                  loading="lazy"
                />
              </section>
            )}

            {doc.videos?.length > 0 && (
              <section>
                <div className="flex items-center gap-3">
                  <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                  <h3 className="secao-titulo">Vídeos recomendados</h3>
                </div>
                <div className="video-rec-list">
                  {doc.videos.map((v) => (
                    <a
                      key={v.id}
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="video-rec-item"
                    >
                      <span className="material-symbols-outlined" style={{ color: "#ff0000" }}>
                        smart_display
                      </span>
                      {/* Título vem da IA: entra como texto, nunca como HTML. */}
                      <span className="video-rec-title">{v.titulo}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: 0.5 }}>
                        open_in_new
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>

        {/* Fora da .summary-grid de propósito: dentro da coluna de conteúdo o
            quiz cairia no meio da página no celular, empurrando vídeos e
            imagem para depois de dezenas de perguntas. */}
        <div className="flex items-center gap-3 mb-4" style={{ marginTop: 40 }}>
          <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
          <h3 className="secao-titulo">Teste seu conhecimento</h3>
        </div>
        {isUuid(doc.id) ? (
          <Quiz conteudoId={doc.id} />
        ) : (
          <p className="quiz-indisponivel">
            O quiz fica disponível depois que o documento é salvo no backend.
          </p>
        )}
      </main>

      <BottomNav />
    </>
  );
}

export default function SummaryPage({ params }: PageProps<"/summary/[id]">) {
  // Next 16: params é uma Promise. Em Client Component ela é desembrulhada
  // com use(), não com await.
  const { id } = use(params);

  return (
    <GuardaSessao>
      <SummaryConteudo id={id} />
    </GuardaSessao>
  );
}
