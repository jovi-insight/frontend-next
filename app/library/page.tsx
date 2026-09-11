"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import GuardaSessao from "@/components/GuardaSessao";
import BottomNav from "@/components/BottomNav";
import { excluirConteudoPermanentemente, moverConteudoParaLixeira, restaurarConteudo } from "@/lib/api";
import { carregarBiblioteca, juntarFotos, urlMiniatura, type FotoBiblioteca } from "@/lib/biblioteca-api";
import { avisar } from "@/lib/avisos";
import { CHAVE_LIXEIRA, lerDescartados } from "@/lib/descartados";

const GaleriaVideos = dynamic(() => import("@/components/GaleriaVideos"), { loading: () => <p role="status">Carregando vídeos…</p> });
type Album = { itens: FotoBiblioteca[]; cursor: string | null; carregado: boolean };
const vazio = (): Album => ({ itens: [], cursor: null, carregado: false });

function LibraryConteudo() {
  const abrirLixeira = useSearchParams().get("lixeira") === "1";
  const [verLixeira, setVerLixeira] = useState(abrirLixeira);
  const [videosAbertos, setVideosAbertos] = useState(false);
  const [albuns, setAlbuns] = useState({ fotos: vazio(), lixeira: vazio() });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const requisicao = useRef<AbortController | null>(null);
  const cacheAlbuns = useRef(albuns);
  const chave = verLixeira ? "lixeira" : "fotos";
  const album = albuns[chave];

  const carregar = useCallback(async (mais = false, atualizar = false) => {
    requisicao.current?.abort();
    const controller = new AbortController(); requisicao.current = controller;
    const atual = cacheAlbuns.current[chave];
    setErro("");
    if (!mais && !atualizar && atual.carregado) { setCarregando(false); return; }
    setCarregando(true); setErro("");
    const prazo = setTimeout(() => controller.abort(), 20000);
    try {
      if (verLixeira && !mais) {
        // Preserva a migração antiga, sem consultar a lixeira ao abrir Fotos.
        try {
          const antigos = [...lerDescartados(localStorage.getItem(CHAVE_LIXEIRA) || "[]")];
          const resultados = await Promise.allSettled(antigos.map(moverConteudoParaLixeira));
          const pendentes = antigos.filter((_, i) => resultados[i].status === "rejected");
          if (pendentes.length) localStorage.setItem(CHAVE_LIXEIRA, JSON.stringify(pendentes));
          else localStorage.removeItem(CHAVE_LIXEIRA);
        } catch { /* Armazenamento bloqueado não impede consultar o banco. */ }
      }
      const pagina = await carregarBiblioteca(verLixeira, mais ? atual.cursor : null, controller.signal);
      if (controller.signal.aborted || requisicao.current !== controller) return;
      const novo = { ...cacheAlbuns.current, [chave]: {
        itens: mais ? juntarFotos(atual.itens, pagina.itens) : pagina.itens,
        cursor: pagina.proximo_cursor, carregado: true,
      } };
      cacheAlbuns.current = novo; setAlbuns(novo);
    } catch (e) {
      if (requisicao.current === controller) setErro(controller.signal.aborted
        ? "O servidor demorou para responder. Suas fotos continuam salvas; tente novamente."
        : (e as Error).message);
    } finally {
      clearTimeout(prazo);
      if (requisicao.current === controller) { requisicao.current = null; setCarregando(false); }
    }
  }, [chave, verLixeira]);

  useEffect(() => {
    // Adia até o efeito estar montado; o primeiro ciclo do StrictMode é cancelado.
    const inicio = window.setTimeout(() => void carregar(), 0);
    return () => { window.clearTimeout(inicio); requisicao.current?.abort(); requisicao.current = null; };
  }, [carregar]);

  const secoes = useMemo(() => {
    const grupos = new Map<string, FotoBiblioteca[]>();
    for (const foto of album.itens) {
      const titulo = foto.materia || "Sem matéria";
      grupos.set(titulo, [...(grupos.get(titulo) || []), foto]);
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [album.itens]);
  const prioritarias = new Set(secoes.flatMap(([, fotos]) => fotos).slice(0, 6).map(f => f.id));

  function sairDaSelecao() { setSelecionando(false); setMarcados(new Set()); }
  function alternarMarca(id: string) {
    setMarcados(antes => { const novos = new Set(antes); if (!novos.delete(id)) novos.add(id); return novos; });
  }
  async function aplicar(acao: "mover" | "restaurar" | "excluir") {
    const ids = [...marcados];
    if (!ids.length || processando) return;
    if (acao === "excluir" && !confirm("Excluir definitivamente " + ids.length + " documento(s)? Essa ação não pode ser desfeita.")) return;
    requisicao.current?.abort(); requisicao.current = null; setCarregando(false);
    setProcessando(true);
    try {
      const executar = acao === "mover" ? moverConteudoParaLixeira : acao === "restaurar" ? restaurarConteudo : excluirConteudoPermanentemente;
      const resultados = await Promise.allSettled(ids.map(id => executar(id)));
      const falhas = resultados.filter(r => r.status === "rejected").length;
      const removidos = new Set(ids.filter((_, i) => resultados[i].status === "fulfilled"));
      const outro = chave === "fotos" ? "lixeira" : "fotos";
      const novos = { ...cacheAlbuns.current,
        [chave]: { ...cacheAlbuns.current[chave], itens: cacheAlbuns.current[chave].itens.filter(f => !removidos.has(f.id)) },
        [outro]: vazio(),
      };
      cacheAlbuns.current = novos; setAlbuns(novos); sairDaSelecao();
      avisar(falhas ? falhas + " documento(s) não foram alterados. Tente novamente." : "Biblioteca atualizada no banco.", falhas ? "erro" : "sucesso");
    } finally { setProcessando(false); }
  }

  return <>
    <main className="container archive-main sem-topbar">
      <nav className="breadcrumb"><Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Início</Link><span aria-hidden="true">›</span><span>{verLixeira ? "Lixeira" : "Biblioteca"}</span></nav>
      {!verLixeira && <div className="secao-acoes" style={{ marginBottom: 20 }}>
        <button className="chip" type="button" aria-expanded={videosAbertos} onClick={() => setVideosAbertos(v => !v)}>{videosAbertos ? "Ocultar vídeos" : "Ver vídeos e aulas gravadas"}</button>
      </div>}
      {!verLixeira && videosAbertos && <GaleriaVideos />}
      <div className="secao-topo">
        <div className="section-title"><h2>{verLixeira ? "Lixeira" : "Fotos das aulas"}</h2></div>
        <div className="secao-acoes">
          {selecionando ? <>
            <button className="chip" disabled={processando} onClick={sairDaSelecao}>Cancelar</button>
            {verLixeira && <button className="chip chip-perigo" disabled={!marcados.size || processando} onClick={() => void aplicar("excluir")}>Excluir de vez ({marcados.size})</button>}
            <button className="chip" disabled={!marcados.size || processando} onClick={() => void aplicar(verLixeira ? "restaurar" : "mover")}>{processando ? "Salvando…" : (verLixeira ? "Restaurar" : "Mover para lixeira") + " (" + marcados.size + ")"}</button>
          </> : <>
            <button className="chip" onClick={() => { setVerLixeira(v => !v); sairDaSelecao(); }}>{verLixeira ? "Voltar às fotos" : "Lixeira"}</button>
            <button className="chip" disabled={!album.itens.length} onClick={() => setSelecionando(true)}>Selecionar</button>
            <button className="chip" disabled={carregando} onClick={() => void carregar(false, true)}>Atualizar</button>
          </>}
        </div>
      </div>
      {verLixeira && <p className="nota-lixeira">Fotos salvas no banco. Restaure ou exclua definitivamente os itens selecionados.</p>}
      {erro && <div role="alert"><p>{erro}</p><button className="chip" disabled={carregando} onClick={() => void carregar(!!album.cursor, true)}>Tentar novamente</button></div>}
      {carregando && !album.itens.length && <div className="album-grade" aria-label="Carregando fotos" role="status">{Array.from({ length: 6 }, (_, i) => <div key={i} className="album-item" style={{ aspectRatio: "1", position: "relative" }}><span className="album-image-loading" /></div>)}</div>}
      {album.carregado && !album.itens.length && !erro && <div className="empty-state"><p>{verLixeira ? "A lixeira está vazia." : "Nenhuma foto arquivada ainda."}</p></div>}
      {secoes.map(([titulo, fotos]) => <section className="album" key={titulo}>
        <header className="album-titulo"><h3>{titulo}</h3><span>{fotos.length} carregadas</span></header>
        <div className="album-grade">{fotos.map(foto => <Miniatura key={foto.id} foto={foto} selecionando={selecionando} marcado={marcados.has(foto.id)} prioritaria={prioritarias.has(foto.id)} onMarcar={() => alternarMarca(foto.id)} />)}</div>
      </section>)}
      {album.cursor && <div style={{ textAlign: "center", padding: "20px 0" }}><button className="chip chip-primario" disabled={carregando || processando} onClick={() => void carregar(true)}>{carregando ? "Carregando fotos…" : "Carregar mais fotos"}</button></div>}
      {!!album.itens.length && <p className="nota-lixeira">{album.itens.length} fotos carregadas{album.cursor ? " · Mais fotos disponíveis" : " · Você chegou ao fim"}. O original abre ao tocar na foto.</p>}
    </main>
    <BottomNav />
  </>;
}

function Miniatura({ foto, selecionando, marcado, prioritaria, onMarcar }: {
  foto: FotoBiblioteca; selecionando: boolean; marcado: boolean; prioritaria: boolean; onMarcar: () => void;
}) {
  const [pronta, setPronta] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const url = fallback ? foto.imagem_url : urlMiniatura(foto);
  const miolo = <>
    {url && !falhou ? <>
      {!pronta && <span className="album-image-loading" aria-hidden="true" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} crossOrigin="anonymous" alt={"Foto de " + (foto.materia || "aula")} width={480} height={480} loading={prioritaria ? "eager" : "lazy"} fetchPriority={prioritaria ? "high" : "auto"} decoding="async" className={pronta ? "is-loaded" : "is-loading"} onLoad={() => setPronta(true)} onError={() => {
        if (!fallback && foto.imagem_url && url !== foto.imagem_url) setFallback(true);
        else setFalhou(true);
      }} />
    </> : <span className="album-photo-missing"><span className="material-symbols-outlined" aria-hidden="true">hide_image</span><small>Foto indisponível</small></span>}
    {foto.resumo_pronto && <span className="material-symbols-outlined selo-resumo" title="Resumo pronto">auto_stories</span>}
    <span className="selo-data">{foto.ultima_atualizacao ? new Date(foto.ultima_atualizacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : ""}</span>
    {foto.paginas > 1 && <span className="selo-paginas" title={foto.paginas + " páginas"}>{foto.paginas}<span className="material-symbols-outlined" aria-hidden="true">filter_none</span></span>}
    {selecionando && <span className={"marca-selecao" + (marcado ? " marcada" : "")} aria-hidden="true"><span className="material-symbols-outlined">{marcado ? "check_circle" : "circle"}</span></span>}
  </>;
  return selecionando
    ? <button type="button" className={"album-item" + (marcado ? " marcado" : "")} aria-pressed={marcado} onClick={onMarcar}>{miolo}</button>
    : <Link href={"/summary/" + foto.id} prefetch={false} className="album-item">{miolo}</Link>;
}

export default function LibraryPage() {
  return <GuardaSessao><Suspense fallback={<main className="container"><p role="status">Carregando biblioteca…</p></main>}><LibraryConteudo /></Suspense></GuardaSessao>;
}
