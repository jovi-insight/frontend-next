"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GuardaSessao from "@/components/GuardaSessao";
import BottomNav from "@/components/BottomNav";
import GaleriaVideos from "@/components/GaleriaVideos";
import { getRecentes, getPastas, getMaterias, type Conteudo, type Materia, type Pasta } from "@/lib/api";
import { useLocalStorage } from "@/lib/use-local-storage";
import { CHAVE_LIXEIRA, lerDescartados, descartar, restaurar } from "@/lib/descartados";

type Dados = { itens: Conteudo[]; pastas: Pasta[]; materias: Materia[] };

function LibraryConteudo() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [verLixeira, setVerLixeira] = useState(false);

  const lixeiraBruta = useLocalStorage(CHAVE_LIXEIRA, "[]");
  const descartados = useMemo(() => lerDescartados(lixeiraBruta), [lixeiraBruta]);

  useEffect(() => {
    // Três rotas em paralelo: o conteúdo traz pasta_id, a pasta traz id_materia
    // e só /materias sabe o nome. É essa cadeia que dá o título de cada seção.
    let ativo = true;
    Promise.all([getRecentes(), getPastas(), getMaterias()])
      .then(([itens, pastas, materias]) => ativo && setDados({ itens, pastas, materias }))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, []);

  /** Documentos agrupados por matéria, como os álbuns da galeria do celular. */
  const secoes = useMemo(() => {
    if (!dados) return [];
    const materiaDaPasta = new Map(dados.pastas.map((p) => [p.id, p.id_materia]));
    const nomeDaMateria = new Map(dados.materias.map((m) => [m.id, m.nome]));

    const grupos = new Map<string, { titulo: string; itens: Conteudo[] }>();
    for (const doc of dados.itens) {
      const naLixeira = descartados.has(doc.id);
      if (verLixeira !== naLixeira) continue;

      const materiaId = doc.pasta_id ? materiaDaPasta.get(doc.pasta_id) : null;
      const titulo = (materiaId && nomeDaMateria.get(materiaId)) || "Sem matéria";
      if (!grupos.has(titulo)) grupos.set(titulo, { titulo, itens: [] });
      grupos.get(titulo)!.itens.push(doc);
    }
    return [...grupos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  }, [dados, descartados, verLixeira]);

  const totalNaLixeira = dados
    ? dados.itens.filter((d) => descartados.has(d.id)).length
    : 0;

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

  function aplicar() {
    const ids = [...marcados];
    if (!ids.length) return sairDaSelecao();
    if (verLixeira) restaurar(descartados, ids);
    else descartar(descartados, ids);
    sairDaSelecao();
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
          <span className="text-primary">{verLixeira ? "Lixeira" : "Recents"}</span>
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
                <button type="button" className="chip" onClick={sairDaSelecao}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`chip ${verLixeira ? "chip-primario" : "chip-perigo"}`}
                  onClick={aplicar}
                  disabled={marcados.size === 0}
                >
                  {verLixeira ? `Restaurar (${marcados.size})` : `Descartar (${marcados.size})`}
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
            O backend não permite apagar um documento — ele continua salvo no banco. Aqui ele só
            fica escondido da galeria deste navegador, e pode voltar quando você quiser.
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
  onMarcar,
}: {
  doc: Conteudo;
  selecionando: boolean;
  marcado: boolean;
  onMarcar: () => void;
}) {
  const thumb = doc.imagem_url || doc.imagens?.[0]?.url_storage;
  const data = doc.ultima_atualizacao
    ? new Date(doc.ultima_atualizacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : "";

  const miolo = (
    <>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" loading="lazy" />
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
      <LibraryConteudo />
    </GuardaSessao>
  );
}
