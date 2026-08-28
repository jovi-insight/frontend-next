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

  const buscarDados = useCallback(async (): Promise<Dados> => {
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
    const [itens, lixeira, pastas, materias] = await Promise.all([
      getRecentes(),
      getLixeira(),
      getPastas(),
      getMaterias(),
    ]);
    return { itens, lixeira, pastas, materias };
  }, []);

  const guardarDados = useCallback((novosDados: Dados) => {
    setDados(novosDados);
    setErro(null);
  }, []);

  const carregarDados = useCallback(async () => {
    guardarDados(await buscarDados());
  }, [buscarDados, guardarDados]);

  useEffect(() => {
    // As rotas rodam em paralelo: o conteúdo traz pasta_id, a pasta traz id_materia
    // e só /materias sabe o nome. É essa cadeia que dá o título de cada seção.
    let ativo = true;
    buscarDados()
      .then((novosDados) => ativo && guardarDados(novosDados))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [buscarDados, guardarDados]);

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
    () => new Set((dados?.itens ?? []).slice(0, 12).map((item) => item.id)),
    [dados],
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

        {erro && (
          <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>
            Falha ao conectar com o banco: {erro}
          </p>
        )}

        {!dados && !erro && (
          <div className="loading-container">
            <div className="spinner" />
          </div>
        )}

        {dados && secoes.length === 0 && (
          <div className="empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.4 }}>
              {verLixeira ? "delete" : "inventory_2"}
            </span>
            <p style={{ marginTop: 16, color: "var(--on-surface-variant)" }}>
              {verLixeira ? "A lixeira está vazia." : "Nenhum documento arquivado no banco ainda."}
            </p>
          </div>
        )}

        {secoes.map((secao) => (
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
  onMarcar,
}: {
  doc: Conteudo;
  selecionando: boolean;
  marcado: boolean;
  prioritaria: boolean;
  onMarcar: () => void;
}) {
  const thumbBruta = doc.imagem_url || doc.imagens?.[0]?.url_storage;
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
            alt=""
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
            <span className="album-image-error" title="Não foi possível carregar a miniatura">
              <span className="material-symbols-outlined">broken_image</span>
              <small>Toque para abrir</small>
            </span>
          )}
        </>
      ) : (
        <span className="material-symbols-outlined" style={{ fontSize: 28, opacity: 0.25 }}>
          description
        </span>
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
