"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import GuardaSessao from "@/components/GuardaSessao";
import BottomNav from "@/components/BottomNav";
import Quiz from "@/components/Quiz";
import VozOndas from "@/components/VozOndas";
import {
  getConteudo,
  gerarResumo,
  traduzirTexto,
  isUuid,
  moverConteudoParaLixeira,
  type Conteudo,
} from "@/lib/api";
import { useNarracao } from "@/lib/use-narracao";
import { pontosDeEstudo, termosChave } from "@/lib/estudo";
import { avisar } from "@/lib/avisos";
import { gravarLocalStorage, useLocalStorage } from "@/lib/use-local-storage";
import { CHAVE_PERFIL, temPerfil } from "@/lib/perfil";

/** Idiomas da narração. O backend recebe o nome por extenso na tradução. */
const IDIOMAS: Record<string, { rotulo: string; nome: string }> = {
  pt: { rotulo: "Português (BR)", nome: "português brasileiro" },
  en: { rotulo: "English (US)", nome: "inglês americano" },
  es: { rotulo: "Español", nome: "espanhol" },
  fr: { rotulo: "Français", nome: "francês" },
  de: { rotulo: "Deutsch", nome: "alemão" },
  it: { rotulo: "Italiano", nome: "italiano" },
};

const CHAVE_IDIOMA = "jovi_idioma_narracao";

function tempo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) segundos = 0;
  const m = String(Math.floor(segundos / 60)).padStart(2, "0");
  const s = String(Math.floor(segundos % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function SummaryConteudo({ id }: { id: string }) {
  const [doc, setDoc] = useState<Conteudo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [movendoParaLixeira, setMovendoParaLixeira] = useState(false);
  const idiomaSalvo = useLocalStorage(CHAVE_IDIOMA, "pt");
  const [idioma, setIdioma] = useState(idiomaSalvo);

  const router = useRouter();
  const perfil = useLocalStorage(CHAVE_PERFIL);
  // O Modo Foco volta com ?voltando=1 — sem isso, sair de lá cairia aqui e
  // seria mandado de volta para o Foco, num laço sem saída.
  const voltando = useSearchParams().get("voltando") === "1";

  // Perfil dislexia/TDAH entra direto no Modo Foco, antes de a tela densa
  // aparecer: mostrar o texto completo por um instante e só então arrancar o
  // usuário dali é exatamente a carga cognitiva que o perfil evita.
  // Só com o resumo pronto — no texto bruto da OCR, o Foco leria o despejo.
  const irParaFoco = temPerfil(perfil, "dislexia-tdah") && !voltando && Boolean(doc?.resumo_ia);

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

  // Antes dos returns antecipados: hook não pode ficar atrás de condição.
  const narracao = useNarracao(async () => {
    const base = doc?.resumo_ia || doc?.extracao_original || "";
    if (!base.trim()) return "";
    // O ElevenLabs fala o texto como ele está: para ouvir em outro idioma,
    // traduz antes (mesma rota da tela de tradução).
    if (idioma === "pt") return base;
    const { traducao } = await traduzirTexto(base, IDIOMAS[idioma].nome);
    return traducao || base;
  });

  function trocarIdioma(codigo: string) {
    setIdioma(codigo);
    gravarLocalStorage(CHAVE_IDIOMA, codigo);
    narracao.parar(); // o áudio em execução está no idioma antigo
  }

  async function paraLixeira() {
    if (!doc) return;
    if (!confirm("Mandar este documento para a lixeira?")) return;
    setMovendoParaLixeira(true);
    try {
      await moverConteudoParaLixeira(doc.id);
      avisar("Documento movido para a lixeira em todos os aparelhos.", "sucesso");
      router.push("/library");
    } catch (e) {
      avisar((e as Error).message, "erro");
      setMovendoParaLixeira(false);
    }
  }

  async function compartilhar() {
    const texto = `${doc?.resumo_ia || doc?.extracao_original || ""}`.trim();
    if (!texto) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Resumo INSIGHT", text: texto });
        return;
      } catch {
        return; // usuário cancelou o compartilhamento
      }
    }
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Resumo copiado.", "sucesso");
    } catch {
      avisar("Não foi possível copiar o resumo.", "erro");
    }
  }

  // Documento recém-salvo chega sem resumo. O vanilla gerava na primeira
  // abertura (js/summary.js:processContent) — sem isso a aula que o aluno
  // acabou de fotografar abre com "(Resumo ainda não gerado)".
  const jaPediu = useRef(false);
  useEffect(() => {
    const bruto = (doc?.extracao_original || "").trim();
    const vazio = !bruto || /nenhum conteúdo textual/i.test(bruto);
    if (!doc || doc.resumo_ia || vazio || !isUuid(doc.id) || jaPediu.current) return;
    jaPediu.current = true;
    pedirResumo();
    // pedirResumo é estável o bastante: só lê `id`, que não muda nesta tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

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
      <main className="container archive-main sem-topbar">
        <p style={{ color: "var(--error)", fontSize: 13 }}>{erro}</p>
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="container archive-main sem-topbar">
        <div className="loading-container">
          <div className="spinner" />
        </div>
      </main>
    );
  }

  const textoBruto = (doc.extracao_original || "").trim();
  // OCR que não achou nada: insistir em "Regenerar" só gasta chamada de IA.
  const semTexto = !textoBruto || /nenhum conteúdo textual/i.test(textoBruto);
  // Guia e termos saem do resumo da IA; sem ele, do texto bruto da OCR.
  const baseEstudo = doc.resumo_ia || textoBruto;
  const pontos = pontosDeEstudo(baseEstudo);
  const termos = termosChave(baseEstudo);
  const primeiraLinha = textoBruto.split(/[.!?\n]/)[0].trim();
  const titulo = primeiraLinha.slice(0, 55) + (primeiraLinha.length > 55 ? "..." : "");

  return (
    <>

      <main className="container archive-main sem-topbar">
        <nav className="breadcrumb" id="summary-breadcrumb">
          <Link href="/library" style={{ textDecoration: "none", color: "inherit" }}>
            Recentes
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
          <div className="secao-acoes">
            <button type="button" className="chip" onClick={compartilhar}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                share
              </span>
              Compartilhar
            </button>
            <button
              type="button"
              className="chip chip-perigo"
              onClick={() => void paraLixeira()}
              disabled={movendoParaLixeira}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                delete
              </span>
              {movendoParaLixeira ? "Movendo…" : "Lixeira"}
            </button>
          </div>
        </section>

        {(doc.imagens?.length > 0 || doc.videos?.length > 0) && (
          <div className="summary-media-principal" aria-label="Mídia do documento">
            {doc.imagens?.length > 0 && (
              <section aria-labelledby="titulo-imagem-documento">
                <div className="flex items-center gap-3">
                  <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                  <h3 id="titulo-imagem-documento" className="secao-titulo">
                    {doc.imagens.length > 1
                      ? `Imagens do documento — ${doc.imagens.length} páginas`
                      : "Imagem original"}
                  </h3>
                </div>
                <div className={doc.imagens.length > 1 ? "paginas-aula" : undefined}>
                  {doc.imagens.map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img.id}
                      src={img.url_storage}
                      alt={
                        doc.imagens.length > 1
                          ? `Página ${i + 1} do documento`
                          : "Imagem original do documento"
                      }
                      className="doc-original-image"
                      loading={i === 0 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : "auto"}
                    />
                  ))}
                </div>
              </section>
            )}

            {doc.videos?.length > 0 && (
              <section className="summary-media-recomendacoes" aria-labelledby="titulo-videos-recomendados">
                <div className="flex items-center gap-3">
                  <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                  <h3 id="titulo-videos-recomendados" className="secao-titulo">
                    Vídeos recomendados
                  </h3>
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
          </div>
        )}

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
                disabled={gerando || semTexto}
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
                  doc.resumo_ia ||
                  (semTexto
                    ? "A leitura não encontrou texto nesta imagem — não há o que resumir. Se foi uma captura ruim, mande para a lixeira e fotografe de novo."
                    : "(Sem resumo ainda — toque em Regenerar.)")
                )}
              </div>
            </div>

            {erro && (
              <p role="alert" style={{ color: "var(--error)", fontSize: 12, marginBottom: 16 }}>
                {erro}
              </p>
            )}

            {pontos.length > 0 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                  <h3 className="secao-titulo">Guia de Estudo</h3>
                </div>
                <ul className="guia-estudo">
                  {pontos.map((ponto, i) => (
                    <li key={i}>
                      <span className="material-symbols-outlined text-primary">check_circle</span>
                      <span>{ponto}.</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="narracao-idioma">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>
                translate
              </span>
              <label htmlFor="idioma-narracao">Idioma do áudio</label>
              <select
                id="idioma-narracao"
                className="lang-dropdown"
                value={idioma}
                onChange={(e) => trocarIdioma(e.target.value)}
              >
                {Object.entries(IDIOMAS).map(([codigo, { rotulo }]) => (
                  <option key={codigo} value={codigo}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>

            <div className="acoes-resumo">
              <button
                type="button"
                onClick={() => narracao.alternar(idioma)}
                disabled={!doc.resumo_ia && !textoBruto}
                aria-pressed={narracao.estado !== "parado"}
              >
                <span
                  className={`material-symbols-outlined text-primary${
                    narracao.estado === "carregando" ? " girando" : ""
                  }`}
                >
                  {narracao.estado === "falando"
                    ? "pause_circle"
                    : narracao.estado === "pausado"
                      ? "play_circle"
                      : narracao.estado === "carregando"
                        ? "progress_activity"
                        : "record_voice_over"}
                </span>
                {narracao.estado === "falando"
                  ? "Pausar"
                  : narracao.estado === "pausado"
                    ? "Continuar"
                    : narracao.estado === "carregando"
                      ? "Gerando voz…"
                      : "Ouvir"}
              </button>
              <Link href={`/focus/${doc.id}`}>
                <span className="material-symbols-outlined text-primary">center_focus_strong</span>
                Modo Foco
              </Link>
              <Link href="/translate">
                <span className="material-symbols-outlined text-primary">g_translate</span>
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
                  Texto extraído
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
            {termos.length > 0 && (
              <section>
                <div className="flex items-center gap-3">
                  <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                  <h3 className="secao-titulo">Termos-chave</h3>
                </div>
                <div className="tag-list">
                  {termos.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </section>
            )}

          </aside>
        </div>

        {/* Fora da .summary-grid para continuar depois do conteúdo e dos termos. */}
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

      {narracao.estado !== "parado" && (
        <section className="audio-player" aria-live="polite">
          <div className="player-panel">
            {/* Esquerda: pausa e continua. Direita: fecha. */}
            <button
              type="button"
              className="primary-btn"
              style={{ width: 48, height: 48, padding: 0, flexShrink: 0 }}
              onClick={() => narracao.alternar(idioma)}
              aria-label={narracao.estado === "pausado" ? "Continuar narração" : "Pausar narração"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                {narracao.estado === "pausado" ? "play_arrow" : "pause"}
              </span>
            </button>

            <div className="player-meio">
              <div className="player-linha">
                <span>
                  {narracao.estado === "carregando"
                    ? "Gerando voz…"
                    : narracao.estado === "pausado"
                      ? "Pausado"
                      : "Narrando"}{" "}
                  · {IDIOMAS[idioma].rotulo}
                </span>
                <span>
                  {tempo(narracao.progresso.atual)} / {tempo(narracao.progresso.total)}
                </span>
              </div>

              <VozOndas
                analisador={narracao.analisador}
                ativo={narracao.estado === "falando"}
              />

              <div className="player-progress-bg">
                <div
                  className="player-progress-fill"
                  style={{
                    width: narracao.progresso.total
                      ? `${(narracao.progresso.atual / narracao.progresso.total) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              className="narracao-parar"
              onClick={narracao.parar}
              aria-label="Fechar narração"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                close
              </span>
            </button>
          </div>
        </section>
      )}

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
