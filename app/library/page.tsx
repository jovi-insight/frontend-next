"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GuardaSessao from "@/components/GuardaSessao";
import BottomNav from "@/components/BottomNav";
import GaleriaVideos from "@/components/GaleriaVideos";
import {
  excluirConteudoPermanentemente,
  getLixeira,
  getMaterias,
  getPastas,
  getRecentes,
  moverConteudoParaLixeira,
  restaurarConteudo,
  type Conteudo,
  type Materia,
  type Pasta,
} from "@/lib/api";
import { avisar } from "@/lib/avisos";
import { CHAVE_LIXEIRA, lerDescartados } from "@/lib/descartados";
import { useLocalStorage } from "@/lib/use-local-storage";

type Dados = {
  itens: Conteudo[];
  lixeira: Conteudo[];
  pastas: Pasta[];
  materias: Materia[];
};

function LibraryConteudo() {
  const abrirLixeira = useSearchParams().get("lixeira") === "1";
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [verLixeira, setVerLixeira] = useState(abrirLixeira);
  const [processando, setProcessando] = useState(false);
  const [recentesCarregados, setRecentesCarregados] = useState(false);
  const [lixeiraCarregada, setLixeiraCarregada] = useState(false);
  const [erroLixeira, setErroLixeira] = useState<string | null>(null);
  const ultimoResultadoBruto = useLocalStorage("jovi_last_scan_result");
  const ultimaImagemCapturada = useLocalStorage("scan_image");

  const previewLocal = useMemo(() => {
    try {
      const resultado = JSON.parse(ultimoResultadoBruto) as { id?: string };
      return resultado.id && ultimaImagemCapturada
        ? { conteudoId: resultado.id, imagem: ultimaImagemCapturada }
        : null;
    } catch {
      return null;
    }
  }, [ultimoResultadoBruto, ultimaImagemCapturada]);

  const migrarLixeiraLegada = useCallback(async () => {
    // Migração única da lixeira antiga, que existia apenas neste navegador.
    // Depois que os ids chegam ao backend, todos os aparelhos enxergam o mesmo estado.
    try {
      const legados = [...lerDescartados(localStorage.getItem(CHAVE_LIXEIRA) || "[]")];
      if (legados.length > 0) {
        const resultados = await Promise.allSettled(legados.map(moverConteudoParaLixeira));
        const pendentes = legados.filter((_, indice) => resultados[indice].status === "rejected");
        if (pendentes.length > 0) {
          localStorage.setItem(CHAVE_LIXEIRA, JSON.stringify(pendentes));
        } else {
          localStorage.removeItem(CHAVE_LIXEIRA);
        }
      }
    } catch {
      // Armazenamento bloqueado não impede consultar a lixeira do servidor.
    }
  }, []);

  const carregarDados = useCallback(async () => {
    const [itens, lixeira] = await Promise.all([getRecentes(), getLixeira()]);
    setDados((atuais) => ({
      itens,
      lixeira,
      pastas: atuais?.pastas ?? [],
      materias: atuais?.materias ?? [],
    }));
    setErro(null);
    setErroLixeira(null);
    setRecentesCarregados(true);
    setLixeiraCarregada(true);

    const [pastas, materias] = await Promise.allSettled([getPastas(), getMaterias()]);
    setDados((atuais) => ({
      itens: atuais?.itens ?? itens,
      lixeira: atuais?.lixeira ?? lixeira,
      pastas: pastas.status === "fulfilled" ? pastas.value : atuais?.pastas ?? [],
      materias: materias.status === "fulfilled" ? materias.value : atuais?.materias ?? [],
    }));
  }, []);

  useEffect(() => {
    // Documentos aparecem assim que /recentes responde. Lixeira e nomes das
    // matérias completam a tela depois, sem segurar a galeria inteira.
    let ativo = true;
    const atualizar = (parcial: Partial<Dados>) => {
      if (!ativo) return;
      setDados((atuais) => ({
        itens: atuais?.itens ?? [],
        lixeira: atuais?.lixeira ?? [],
        pastas: atuais?.pastas ?? [],
        materias: atuais?.materias ?? [],
        ...parcial,
      }));
    };

    getRecentes()
      .then((itens) => {
        atualizar({ itens });
        if (ativo) setErro(null);
      })
      .catch((e: Error) => ativo && setErro(e.message))
      .finally(() => ativo && setRecentesCarregados(true));

    getPastas().then((pastas) => atualizar({ pastas })).catch(() => undefined);
    getMaterias().then((materias) => atualizar({ materias })).catch(() => undefined);

    void (async () => {
      try {
        await migrarLixeiraLegada();
        const lixeira = await getLixeira();
        atualizar({ lixeira });
        if (ativo) setErroLixeira(null);
      } catch (e) {
        if (ativo) setErroLixeira((e as Error).message);
      } finally {
        if (ativo) setLixeiraCarregada(true);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [migrarLixeiraLegada]);

  /** Documentos agrupados por matéria, como os álbuns da galeria do celular. */
  const secoes = useMemo(() => {
    if (!dados) return [];
    const materiaDaPasta = new Map(dados.pastas.map((p) => [p.id, p.id_materia]));
    const nomeDaMateria = new Map(dados.materias.map((m) => [m.id, m.nome]));

    const grupos = new Map<string, { titulo: string; itens: Conteudo[] }>();
    for (const doc of verLixeira ? dados.lixeira : dados.itens) {
      const materiaId = doc.pasta_id ? materiaDaPasta.get(doc.pasta_id) : null;
      const titulo = (materiaId && nomeDaMateria.get(materiaId)) || "Sem matéria";
      if (!grupos.has(titulo)) grupos.set(titulo, { titulo, itens: [] });
      grupos.get(titulo)!.itens.push(doc);
    }
    return [...grupos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  }, [dados, verLixeira]);

  const totalNaLixeira = dados?.lixeira.length ?? 0;

  // As primeiras miniaturas precisam aparecer imediatamente. As demais seguem
  // em lazy loading para a galeria não baixar dezenas de MB de uma vez.
  const imagensPrioritarias = useMemo(
    () =>
      new Set(
        ((verLixeira ? dados?.lixeira : dados?.itens) ?? [])
          .slice(0, 12)
          .map((item) => item.id),
      ),
    [dados, verLixeira],
  );

  function alternarMarca(id: string) {
    setMarcados((antes) => {
      const novo = new Set(antes);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function sairDaSelecao() {
    setSelecionando(false);
    setMarcados(new Set());
  }

  async function aplicar(acao: "mover" | "restaurar" | "excluir") {
    const ids = [...marcados];
    if (!ids.length) return sairDaSelecao();
    if (
      acao === "excluir" &&
      !confirm(
        `Excluir definitivamente ${ids.length} ${ids.length === 1 ? "documento" : "documentos"}? Essa ação não pode ser desfeita.`,
      )
    ) return;

    setProcessando(true);
    try {
      if (acao === "mover") {
        await Promise.all(ids.map(moverConteudoParaLixeira));
        avisar("Documento(s) movido(s) para a lixeira.", "sucesso");
      } else if (acao === "restaurar") {
        await Promise.all(ids.map(restaurarConteudo));
        avisar("Documento(s) restaurado(s).", "sucesso");
      } else {
        await Promise.all(ids.map(excluirConteudoPermanentemente));
        avisar("Documento(s) excluído(s) definitivamente.", "sucesso");
      }
      await carregarDados();
      sairDaSelecao();
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <>

      <main className="container archive-main sem-topbar">
        <nav className="breadcrumb">
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            Início
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            chevron_right
          </span>
          <span className="text-primary">{verLixeira ? "Lixeira" : "Recentes"}</span>
        </nav>

        {!verLixeira && <GaleriaVideos />}

        <div className="secao-topo">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>{verLixeira ? "Lixeira" : "Documentos"}</h2>
          </div>

          <div className="secao-acoes">
            {selecionando ? (
              <>
                <button type="button" className="chip" onClick={sairDaSelecao} disabled={processando}>
                  Cancelar
                </button>
                {verLixeira && (
                  <button
                    type="button"
                    className="chip chip-perigo"
                    onClick={() => void aplicar("excluir")}
                    disabled={marcados.size === 0 || processando}
                  >
                    Excluir de vez ({marcados.size})
                  </button>
                )}
                <button
                  type="button"
                  className={`chip ${verLixeira ? "chip-primario" : "chip-perigo"}`}
                  onClick={() => void aplicar(verLixeira ? "restaurar" : "mover")}
                  disabled={marcados.size === 0 || processando}
                >
                  {processando
                    ? "Processando…"
                    : verLixeira
                      ? `Restaurar (${marcados.size})`
                      : `Lixeira (${marcados.size})`}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`chip${verLixeira ? " chip-primario" : ""}`}
                  onClick={() => {
                    setVerLixeira((v) => !v);
                    sairDaSelecao();
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {verLixeira ? "arrow_back" : "delete"}
                  </span>
                  {verLixeira ? "Voltar" : `Lixeira${totalNaLixeira ? ` (${totalNaLixeira})` : ""}`}
                </button>
                <button type="button" className="chip" onClick={() => setSelecionando(true)}>
                  Selecionar
                </button>
              </>
            )}
          </div>
        </div>

        {verLixeira && (
          <p className="nota-lixeira">
            A lixeira agora é sincronizada com o banco. Você pode restaurar um documento ou
            excluí-lo definitivamente do banco e do Storage.
          </p>
        )}

        {erro && !verLixeira && (
          <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>
            Falha ao conectar com o banco: {erro}
          </p>
        )}

        {erroLixeira && verLixeira && (
          <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>
            Falha ao carregar a lixeira: {erroLixeira}
          </p>
        )}

        {((!verLixeira && !recentesCarregados && !erro) ||
          (verLixeira && !lixeiraCarregada && !erroLixeira)) && (
          <div className="loading-container">
            <div className="spinner" />
          </div>
        )}

        {dados &&
          (verLixeira ? lixeiraCarregada && !erroLixeira : recentesCarregados && !erro) &&
          secoes.length === 0 && (
          <div className="empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.4 }}>
              {verLixeira ? "delete" : "inventory_2"}
            </span>
            <p style={{ marginTop: 16, color: "var(--on-surface-variant)" }}>
              {verLixeira ? "A lixeira está vazia." : "Nenhum documento arquivado no banco ainda."}
            </p>
          </div>
        )}

        {(verLixeira ? lixeiraCarregada : recentesCarregados) && secoes.map((secao) => (
          <section key={secao.titulo} className="album">
            <header className="album-titulo">
              <h3>{secao.titulo}</h3>
              <span>{secao.itens.length}</span>
            </header>

            <div className="album-grade">
              {secao.itens.map((doc) => (
                <Miniatura
                  key={doc.id}
                  doc={doc}
                  selecionando={selecionando}
                  marcado={marcados.has(doc.id)}
                  prioritaria={imagensPrioritarias.has(doc.id)}
                  previewLocal={previewLocal?.conteudoId === doc.id ? previewLocal.imagem : null}
                  onMarcar={() => alternarMarca(doc.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      <BottomNav />
    </>
  );
}

function Miniatura({
  doc,
  selecionando,
  marcado,
  prioritaria,
  previewLocal,
  onMarcar,
}: {
  doc: Conteudo;
  selecionando: boolean;
  marcado: boolean;
  prioritaria: boolean;
  previewLocal: string | null;
  onMarcar: () => void;
}) {
  const thumbBruta = doc.imagem_url || doc.imagens?.[0]?.url_storage || previewLocal;
  const thumb = thumbBruta?.replace(/\?$/, "") || null;
  const [tentativa, setTentativa] = useState(0);
  const [imagemPronta, setImagemPronta] = useState(false);
  const [imagemFalhou, setImagemFalhou] = useState(false);

  useEffect(() => {
    if (!imagemFalhou || tentativa >= 2) return;
    const timer = window.setTimeout(() => {
      setTentativa((atual) => atual + 1);
      setImagemFalhou(false);
    }, 500 * (tentativa + 1));
    return () => window.clearTimeout(timer);
  }, [imagemFalhou, tentativa]);

  const thumbComTentativa =
    thumb && tentativa > 0
      ? `${thumb}${thumb.includes("?") ? "&" : "?"}insight_retry=${tentativa}`
      : thumb;
  const data = doc.ultima_atualizacao
    ? new Date(doc.ultima_atualizacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : "";
  const fotoIndisponivel = (
    <span
      className="album-photo-missing"
      title="Este registro não possui uma foto vinculada no banco"
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        hide_image
      </span>
      <small>Foto indisponível</small>
    </span>
  );

  const miolo = (
    <>
      {thumbComTentativa ? (
        <>
          {!imagemPronta && tentativa < 2 && (
            <span className="album-image-loading" aria-hidden="true" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={tentativa}
            src={thumbComTentativa}
            alt="Foto capturada do conteúdo"
            loading={prioritaria ? "eager" : "lazy"}
            fetchPriority={prioritaria ? "high" : "auto"}
            decoding="async"
            referrerPolicy="no-referrer"
            className={imagemPronta ? "is-loaded" : "is-loading"}
            onLoad={() => {
              setImagemPronta(true);
              setImagemFalhou(false);
            }}
            onError={() => {
              setImagemPronta(false);
              setImagemFalhou(true);
            }}
          />
          {imagemFalhou && tentativa >= 2 && (
            fotoIndisponivel
          )}
        </>
      ) : (
        fotoIndisponivel
      )}
      {doc.resumo_ia && (
        <span className="material-symbols-outlined selo-resumo" title="Resumo pronto">
          auto_stories
        </span>
      )}
      <span className="selo-data">{data}</span>
      {doc.imagens?.length > 1 && (
        <span className="selo-paginas" title={`Aula com ${doc.imagens.length} páginas`}>
          {doc.imagens.length}
          <span className="material-symbols-outlined">filter_none</span>
        </span>
      )}
      {selecionando && (
        <span className={`marca-selecao${marcado ? " marcada" : ""}`} aria-hidden="true">
          <span className="material-symbols-outlined">{marcado ? "check_circle" : "circle"}</span>
        </span>
      )}
    </>
  );

  // Em modo de seleção o toque marca em vez de navegar — abrir o documento no
  // meio de uma seleção múltipla perderia tudo o que já foi marcado.
  if (selecionando) {
    return (
      <button
        type="button"
        className={`album-item${marcado ? " marcado" : ""}`}
        onClick={onMarcar}
        aria-pressed={marcado}
      >
        {miolo}
      </button>
    );
  }

  return (
    <Link href={`/summary/${doc.id}`} className="album-item">
      {miolo}
    </Link>
  );
}

export default function LibraryPage() {
  return (
    <GuardaSessao>
      <Suspense
        fallback={
          <main className="container archive-main sem-topbar">
            <div className="loading-container"><div className="spinner" /></div>
          </main>
        }
      >
        <LibraryConteudo />
      </Suspense>
    </GuardaSessao>
  );
}
