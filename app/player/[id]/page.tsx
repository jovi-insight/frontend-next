"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GuardaSessao from "@/components/GuardaSessao";
import TopHeader from "@/components/TopHeader";
import Quiz from "@/components/Quiz";
import VozOndas from "@/components/VozOndas";
import {
  obterVideo,
  salvarTranscricao,
  salvarResumoVideo,
  removerVideo,
  type VideoItem,
  type Segmento,
} from "@/lib/video-library";
import { transcreverMidia } from "@/lib/libras-ml";
import { criarVtt } from "@/lib/video-vtt";
import { traduzirTexto, isUuid, gerarResumo } from "@/lib/api";
import { pontosDeEstudo, termosChave } from "@/lib/estudo";
import { useNarracao } from "@/lib/use-narracao";
import { avisar } from "@/lib/avisos";
import { gravarLocalStorage, useLocalStorage } from "@/lib/use-local-storage";

const IDIOMAS: Record<string, { rotulo: string; nome: string }> = {
  pt: { rotulo: "Português (BR)", nome: "português brasileiro" },
  en: { rotulo: "English (US)", nome: "inglês americano" },
  es: { rotulo: "Español", nome: "espanhol" },
  fr: { rotulo: "Français", nome: "francês" },
  de: { rotulo: "Deutsch", nome: "alemão" },
  it: { rotulo: "Italiano", nome: "italiano" },
};

const CHAVE_IDIOMA = "jovi_idioma_narracao";

function formatarTempo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) segundos = 0;
  const m = String(Math.floor(segundos / 60)).padStart(2, "0");
  const s = String(Math.floor(segundos % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function PlayerConteudo({ id }: { id: string }) {
  const router = useRouter();
  const [item, setItem] = useState<VideoItem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [urlVideo, setUrlVideo] = useState<string | null>(null);
  const [legendaLigada, setLegendaLigada] = useState(true);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [tempoAtual, setTempoAtual] = useState(0);

  const idiomaSalvo = useLocalStorage(CHAVE_IDIOMA, "pt");
  const [idioma, setIdioma] = useState(idiomaSalvo);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let ativo = true;
    let url: string | null = null;
    let revogar = false;

    obterVideo(id)
      .then((v) => {
        if (!ativo) return;
        if (!v) {
          setErro("Vídeo não encontrado na galeria deste navegador.");
          return;
        }
        setItem(v);
        if (v.blob) {
          url = URL.createObjectURL(v.blob);
          revogar = true;
        } else {
          url = v.remoteUrl || null;
        }
        if (!url) {
          setErro("O arquivo deste vídeo não está disponível.");
          return;
        }
        setUrlVideo(url);
      })
      .catch((e: Error) => ativo && setErro(e.message));

    return () => {
      ativo = false;
      if (url && revogar) URL.revokeObjectURL(url);
    };
  }, [id]);

  const textoFala = item?.transcription?.text || "";
  const segmentos = useMemo(() => item?.transcription?.segments ?? [], [item]);

  // Base do estudo: usa o resumo se já gerado, ou a transcrição completa
  const baseEstudo = item?.summary || textoFala;
  const pontos = useMemo(() => pontosDeEstudo(baseEstudo), [baseEstudo]);
  const termos = useMemo(() => termosChave(baseEstudo), [baseEstudo]);

  // Faixa de legendas WebVTT
  const urlLegenda = useMemo(() => {
    if (!segmentos.length) return null;
    return URL.createObjectURL(new Blob([criarVtt(segmentos)], { type: "text/vtt" }));
  }, [segmentos]);

  useEffect(() => {
    return () => {
      if (urlLegenda) URL.revokeObjectURL(urlLegenda);
    };
  }, [urlLegenda]);

  useEffect(() => {
    const faixa = videoRef.current?.textTracks?.[0];
    if (faixa) faixa.mode = legendaLigada ? "showing" : "disabled";
  }, [legendaLigada, urlLegenda]);

  // Transcrição do vídeo via Gemini / microserviço
  const transcrever = useCallback(async () => {
    if (!item) return false;
    setTranscrevendo(true);
    setErro(null);
    try {
      let midia = item.blob;
      if (!midia && item.remoteUrl) {
        const resposta = await fetch(item.remoteUrl);
        if (!resposta.ok) throw new Error("Não foi possível baixar o vídeo salvo para transcrever.");
        midia = await resposta.blob();
      }
      if (!midia) throw new Error("O arquivo do vídeo não está disponível.");
      const resultado = await transcreverMidia(midia, item.name);
      const salvo = await salvarTranscricao(item.id, resultado);
      setItem(salvo);
      avisar(
        salvo.syncStatus === "sincronizado"
          ? "Vídeo transcrito e atualizado no banco!"
          : "Transcrição salva no aparelho; sincronização pendente.",
        salvo.syncStatus === "sincronizado" ? "sucesso" : "info",
      );
      return true;
    } catch (e) {
      setErro(
        `${(e as Error).message} — confira a conexão com o backend ou a chave do Gemini.`,
      );
      return false;
    } finally {
      setTranscrevendo(false);
    }
  }, [item]);

  async function alternarLegenda() {
    if (legendaLigada) {
      setLegendaLigada(false);
      return;
    }
    if (!item?.transcription && !(await transcrever())) return;
    setLegendaLigada(true);
  }

  // Geração de Resumo inteligente por IA para o vídeo
  const pedirResumo = useCallback(async () => {
    if (!item) return;
    const texto = item.transcription?.text || "";
    if (!texto.trim()) {
      avisar("Transcreva o vídeo primeiro para gerar o resumo.", "info");
      return;
    }

    setGerandoResumo(true);
    setErro(null);
    try {
      if (item.conteudoId && isUuid(item.conteudoId)) {
        const { resumo } = await gerarResumo(item.conteudoId);
        const atualizado = await salvarResumoVideo(item.id, resumo);
        setItem(atualizado);
      } else {
        // Gera resumo estruturado a partir dos pontos de estudo
        const pontosTexto = pontosDeEstudo(texto, 6);
        const resumoSintetizado =
          pontosTexto.length > 0
            ? pontosTexto.join(". ") + "."
            : texto.slice(0, 300) + "...";
        const atualizado = await salvarResumoVideo(item.id, resumoSintetizado);
        setItem(atualizado);
      }
      avisar("Resumo do vídeo gerado com sucesso!", "sucesso");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setGerandoResumo(false);
    }
  }, [item]);

  // Narração em áudio (ElevenLabs / Web Speech)
  const narracao = useNarracao(async () => {
    const base = item?.summary || item?.transcription?.text || "";
    if (!base.trim()) return "";
    if (idioma === "pt") return base;
    const { traducao } = await traduzirTexto(base, IDIOMAS[idioma].nome);
    return traducao || base;
  });

  function trocarIdioma(codigo: string) {
    setIdioma(codigo);
    gravarLocalStorage(CHAVE_IDIOMA, codigo);
    narracao.parar();
  }

  function irParaTrecho(seg: Segmento) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seg.start;
    void videoRef.current.play();
  }

  function abrirModoFoco() {
    if (!item) return;
    gravarLocalStorage(
      "jovi_last_scan_result",
      JSON.stringify({
        id: item.id,
        extracao_original: item.transcription?.text || item.name,
        resumo_ia: item.summary || item.transcription?.text || "",
      }),
    );
    router.push(`/focus/${item.conteudoId || item.id}`);
  }

  function abrirTradutor() {
    if (!item) return;
    gravarLocalStorage(
      "jovi_last_scan_result",
      JSON.stringify({
        id: item.id,
        extracao_original: item.transcription?.text || "",
        resumo_ia: item.summary || "",
      }),
    );
    router.push("/translate");
  }

  async function compartilhar() {
    const texto = `${item?.name || "Vídeo"}\n\n${item?.summary || item?.transcription?.text || ""}`.trim();
    if (!texto) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: item?.name || "Vídeo INSIGHT", text: texto });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Conteúdo copiado para a área de transferência.", "sucesso");
    } catch {
      avisar("Não foi possível copiar.", "erro");
    }
  }

  async function excluirVideo() {
    if (!item) return;
    if (!confirm(`Deseja excluir o vídeo "${item.name}" do aparelho e do banco?`)) return;
    try {
      await removerVideo(item.id);
      avisar("Vídeo excluído do aparelho e do banco.", "sucesso");
      router.push("/library");
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  if (erro && !item) {
    return (
      <main className="container archive-main">
        <p style={{ color: "var(--error)", fontSize: 13 }}>{erro}</p>
        <Link href="/library" className="focus-link">
          Voltar para a biblioteca
        </Link>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="container archive-main sem-topbar">
        <div className="loading-container">
          <div className="spinner" />
        </div>
      </main>
    );
  }

  return (
    <>
      <TopHeader titulo="Vídeo" voltarPara="/library" />

      <main className="container archive-main">
        <nav className="breadcrumb">
          <Link href="/library" style={{ textDecoration: "none", color: "inherit" }}>
            Recentes
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            chevron_right
          </span>
          <span className="text-primary">{item?.name ?? "Vídeo"}</span>
        </nav>

        {/* Player de Vídeo Principal */}
        <section style={{ marginBottom: 24 }}>
          {urlVideo && (
            <video
              ref={videoRef}
              src={urlVideo}
              controls
              playsInline
              onTimeUpdate={() => {
                if (videoRef.current) setTempoAtual(videoRef.current.currentTime);
              }}
              className="player-video"
              style={{
                width: "100%",
                borderRadius: 16,
                background: "#000",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {urlLegenda && (
                <track
                  key={urlLegenda}
                  kind="captions"
                  srcLang="pt-BR"
                  label="Português (transcrição INSIGHT)"
                  src={urlLegenda}
                  default={legendaLigada}
                />
              )}
            </video>
          )}

          <div
            className="flex items-center justify-between"
            style={{ marginTop: 14, flexWrap: "wrap", gap: 10 }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`video-toggle-btn${legendaLigada ? " ativo" : ""}`}
                onClick={alternarLegenda}
                disabled={transcrevendo}
                aria-pressed={legendaLigada}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  closed_caption
                </span>
                {transcrevendo
                  ? "Transcrevendo…"
                  : legendaLigada
                    ? "Legenda ativada"
                    : "Ativar legenda"}
              </button>

              {!item?.transcription && !transcrevendo && (
                <button
                  type="button"
                  className="chip chip-primario"
                  onClick={transcrever}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    auto_awesome
                  </span>
                  Transcrever com IA
                </button>
              )}
            </div>

            <div className="secao-acoes">
              <button type="button" className="chip" onClick={compartilhar}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  share
                </span>
                Compartilhar
              </button>
              <button type="button" className="chip chip-perigo" onClick={excluirVideo}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  delete
                </span>
                Excluir
              </button>
            </div>
          </div>
        </section>

        {/* Grade de Conteúdo e Estudo igual à de Imagens/Aulas */}
        <div className="summary-grid">
          <section className="summary-content">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                <h3 className="secao-titulo">Resumo da Aula em Vídeo</h3>
              </div>
              {item?.transcription && (
                <button
                  type="button"
                  className="text-primary"
                  onClick={pedirResumo}
                  disabled={gerandoResumo || !textoFala}
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
                  {gerandoResumo ? "Gerando resumo…" : "Regenerar"}
                </button>
              )}
            </div>

            {/* Cartão de Resumo */}
            <div className="summary-card" style={{ marginBottom: 28 }}>
              {gerandoResumo && (
                <p className="summary-text" style={{ opacity: 0.6 }}>
                  A inteligência artificial está resumindo o conteúdo do vídeo…
                </p>
              )}
              {!gerandoResumo && item?.summary && (
                <div className="summary-text" style={{ whiteSpace: "pre-wrap" }}>
                  {item.summary}
                </div>
              )}
              {!gerandoResumo && !item?.summary && (
                <p className="summary-text" style={{ opacity: 0.6 }}>
                  {textoFala
                    ? "Toque em 'Regenerar' ou 'Transcrever' para gerar o resumo com inteligência artificial."
                    : "Ative a transcrição do vídeo para gerar o resumo, tópicos e quiz automaticamente."}
                </p>
              )}
            </div>

            {/* Seletor de Idioma e Ações Rápidas */}
            <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 12 }}>
              <div className="flex items-center gap-3">
                <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                <h3 className="secao-titulo">Estudo e Acessibilidade</h3>
              </div>
              <select
                className="lang-dropdown"
                value={idioma}
                onChange={(e) => trocarIdioma(e.target.value)}
                aria-label="Idioma da narração"
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
                disabled={!baseEstudo}
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
                      : "Ouvir resumo"}
              </button>
              <button type="button" className="link-limpo" onClick={abrirModoFoco} disabled={!baseEstudo}>
                <span className="material-symbols-outlined text-primary">center_focus_strong</span>
                Modo Foco
              </button>
              <button type="button" className="link-limpo" onClick={abrirTradutor} disabled={!baseEstudo}>
                <span className="material-symbols-outlined text-primary">g_translate</span>
                Traduzir
              </button>
            </div>

            {/* Painel Interativo de Transcrição com Minutagem Clicável */}
            <div className="video-transcription-panel" style={{ marginBottom: 28 }}>
              <div className="video-transcription-header">
                <div>
                  <h3>Transcrição com Minutagem</h3>
                  <p>Clique em qualquer trecho para pular o vídeo até aquele momento.</p>
                </div>
                {segmentos.length > 0 && (
                  <span className="chip" style={{ fontSize: 10 }}>
                    {segmentos.length} trechos
                  </span>
                )}
              </div>

              {segmentos.length > 0 ? (
                <div className="transcript-segments">
                  {segmentos.map((seg, idx) => {
                    const ativo = tempoAtual >= seg.start && tempoAtual <= seg.end;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`transcript-segment${ativo ? " active" : ""}`}
                        onClick={() => irParaTrecho(seg)}
                        title={`Pular para ${formatarTempo(seg.start)}`}
                      >
                        <span className="transcript-time">{formatarTempo(seg.start)}</span>
                        <span className="transcript-copy">{seg.text}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="transcript-empty">
                  <p style={{ fontSize: 12 }}>
                    {transcrevendo
                      ? "Transcrevendo áudio com o Gemini…"
                      : "Nenhuma transcrição ativa. Clique em 'Transcrever com IA' acima."}
                  </p>
                </div>
              )}
            </div>

            {/* Quiz Interativo sobre o Vídeo */}
            <div className="flex items-center gap-3 mb-4">
              <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
              <h3 className="secao-titulo">Quiz sobre a Aula</h3>
            </div>
            {item.conteudoId && isUuid(item.conteudoId) ? (
              <Quiz conteudoId={item.conteudoId} />
            ) : (
              <p className="summary-text" style={{ opacity: 0.6 }}>
                Salve a transcrição como conteúdo de uma matéria para gerar um quiz desta aula.
              </p>
            )}
          </section>

          {/* Barra Lateral: Termos-Chave, Guia de Estudo e Detalhes */}
          <aside className="summary-aside">
            {termos.length > 0 && (
              <section>
                <div className="flex items-center gap-3">
                  <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                  <h3 className="secao-titulo">Assuntos e Termos-chave</h3>
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

            {pontos.length > 0 && (
              <section>
                <div className="flex items-center gap-3">
                  <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                  <h3 className="secao-titulo">Tópicos Principais</h3>
                </div>
                <div className="study-guide-list">
                  {pontos.map((ponto, i) => (
                    <div key={i} className="study-point-item">
                      <span className="study-point-bullet">{i + 1}</span>
                      <p className="study-point-text">{ponto}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Ficha Técnica do Vídeo */}
            <section>
              <div className="flex items-center gap-3">
                <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
                <h3 className="secao-titulo">Detalhes da Gravação</h3>
              </div>
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--on-surface-variant)" }}>Duração</span>
                  <strong>{formatarTempo(item.duration)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--on-surface-variant)" }}>Data</span>
                  <span>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--on-surface-variant)" }}>Tamanho</span>
                  <span>{(item.size / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--on-surface-variant)" }}>Sincronização</span>
                  <span>
                    {item.syncStatus === "sincronizado" ? "Banco + offline" : "Pendente"}
                  </span>
                </div>
                {item.transcription?.language && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--on-surface-variant)" }}>Idioma falado</span>
                    <span style={{ textTransform: "uppercase" }}>{item.transcription.language}</span>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>

        {/* Player de Narração Flutuante */}
        {narracao.estado !== "parado" && (
          <section className="audio-player" aria-live="polite">
            <div className="player-panel">
              <button
                type="button"
                className="player-btn"
                onClick={() => narracao.alternar(idioma)}
                aria-label={narracao.estado === "falando" ? "Pausar narração" : "Continuar narração"}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                  {narracao.estado === "falando" ? "pause_circle" : "play_circle"}
                </span>
              </button>

              <div className="player-meio">
                <div className="player-linha">
                  <span>Narração do vídeo ({IDIOMAS[idioma].rotulo})</span>
                  {narracao.progresso.total > 0 && (
                    <span>
                      {formatarTempo(narracao.progresso.atual)} / {formatarTempo(narracao.progresso.total)}
                    </span>
                  )}
                </div>
                <div className="player-linha" style={{ marginTop: 6 }}>
                  <VozOndas analisador={narracao.analisador} ativo={narracao.estado === "falando"} />
                </div>
                {narracao.progresso.total > 0 && (
                  <div className="player-progress-bg">
                    <div
                      className="player-progress-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          (narracao.progresso.atual / narracao.progresso.total) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                className="player-fechar"
                onClick={narracao.parar}
                aria-label="Fechar narração"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </section>
        )}

        {erro && (
          <p role="alert" style={{ color: "var(--error)", fontSize: 12, marginTop: 16 }}>
            {erro}
          </p>
        )}
      </main>
    </>
  );
}

export default function PlayerPage({ params }: PageProps<"/player/[id]">) {
  const { id } = use(params);
  return (
    <GuardaSessao>
      <PlayerConteudo id={id} />
    </GuardaSessao>
  );
}
