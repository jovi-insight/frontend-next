"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GuardaSessao from "@/components/GuardaSessao";
import BottomNav from "@/components/BottomNav";
import { avisar } from "@/lib/avisos";
import {
  getMaterias,
  getPastas,
  getPasta,
  renomearPasta,
  excluirPasta,
  criarMateria,
  type Conteudo,
  type Materia,
  type Pasta,
} from "@/lib/api";

// Hierarquia de três níveis, igual ao vanilla: matéria → pasta → documentos.
type Nivel =
  | { tipo: "raiz" }
  | { tipo: "materia"; materiaId: string }
  | { tipo: "pasta"; materiaId: string; pastaId: string };

function plural(n: number) {
  return `${n} ${n === 1 ? "item" : "itens"}`;
}

function FoldersConteudo() {
  const [nivel, setNivel] = useState<Nivel>({ tipo: "raiz" });
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [conteudos, setConteudos] = useState<{ pastaId: string; itens: Conteudo[] } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // 24 das 30 matérias do banco não têm nenhuma pasta — são sugestões que a IA
  // criou e ninguém usou. Mostrá-las por padrão faz a tela parecer suja.
  const [mostrarVazias, setMostrarVazias] = useState(false);

  // Buscar e gravar ficam separados de propósito: assim o efeito abaixo só
  // grava dentro do .then(), sem setState no corpo síncrono dele.
  const buscarRaiz = useCallback(() => Promise.all([getMaterias(), getPastas()]), []);

  const guardarRaiz = useCallback(([ms, ps]: [Materia[], Pasta[]]) => {
    setMaterias(ms);
    setPastas(ps);
    setErro(null);
  }, []);

  useEffect(() => {
    let ativo = true;
    buscarRaiz()
      .then((dados) => ativo && guardarRaiz(dados))
      .catch((e: Error) => ativo && setErro(e.message))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [buscarRaiz, guardarRaiz]);

  /** Releitura após renomear/excluir — ação do usuário, não efeito. */
  async function recarregar() {
    setCarregando(true);
    try {
      guardarRaiz(await buscarRaiz());
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  // Os documentos de uma pasta só vêm de /pastas/{id}, então a busca acontece
  // ao entrar no terceiro nível — não junto com a listagem inicial. Guardar o
  // id junto evita mostrar os documentos da pasta anterior por um instante,
  // sem precisar de um setConteudos(null) síncrono só para limpar.
  useEffect(() => {
    if (nivel.tipo !== "pasta") return;
    const pastaId = nivel.pastaId;
    let ativo = true;
    getPasta(pastaId)
      .then((p) => ativo && setConteudos({ pastaId, itens: p.conteudos ?? [] }))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [nivel]);

  // Os documentos em mãos só valem para a pasta aberta agora.
  const conteudosDaPasta =
    nivel.tipo === "pasta" && conteudos?.pastaId === nivel.pastaId ? conteudos.itens : null;

  async function aoCriarMateria() {
    const nome = prompt("Nome da nova matéria/pasta:");
    if (!nome?.trim()) return;
    try {
      await criarMateria(nome.trim());
      await recarregar();
      avisar("Matéria criada com sucesso!", "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  async function aoRenomear(pasta: Pasta) {
    const novo = prompt("Novo nome da pasta:", pasta.nome);
    if (!novo?.trim() || novo.trim() === pasta.nome) return;
    try {
      await renomearPasta(pasta.id, novo.trim());
      await recarregar();
      avisar("Pasta renomeada.", "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  async function aoExcluir(pasta: Pasta) {
    const total = pasta.quantidade_arquivos || 0;
    if (!confirm(`Excluir a pasta "${pasta.nome}" e seus ${plural(total)}?`)) return;
    try {
      await excluirPasta(pasta.id);
      await recarregar();
      avisar("Pasta excluída.", "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  // Cada matéria com o total de arquivos das pastas dela.
  const materiasComTotal = materias
    // O backend cria uma matéria com esse nome quando a OCR não acha texto;
    // ela não representa nada para o aluno.
    .filter((m) => !m.nome.toLowerCase().startsWith("nenhum conteúdo textual"))
    .map((materia) => ({
      materia,
      total: pastas
        .filter((p) => p.id_materia === materia.id)
        .reduce((soma, p) => soma + (p.quantidade_arquivos || 0), 0),
    }));

  const vazias = materiasComTotal.filter((m) => m.total === 0).length;
  const materiasVisiveis = mostrarVazias
    ? materiasComTotal
    : materiasComTotal.filter((m) => m.total > 0);

  const materiaAtual =
    nivel.tipo !== "raiz" ? materias.find((m) => m.id === nivel.materiaId) : undefined;
  const pastaAtual =
    nivel.tipo === "pasta" ? pastas.find((p) => p.id === nivel.pastaId) : undefined;

  return (
    <>

      <main className="container archive-main sem-topbar">
        <nav className="breadcrumb">
          <button className="link-limpo" onClick={() => setNivel({ tipo: "raiz" })}>
            Matérias
          </button>
          {materiaAtual && (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                chevron_right
              </span>
              <button
                className="link-limpo"
                onClick={() => setNivel({ tipo: "materia", materiaId: materiaAtual.id })}
              >
                {materiaAtual.nome}
              </button>
            </>
          )}
          {pastaAtual && (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                chevron_right
              </span>
              <span className="text-primary">{pastaAtual.nome}</span>
            </>
          )}
        </nav>

        <div className="secao-topo">
          <div className="section-title">
            <div style={{ width: 4, height: 24, backgroundColor: "var(--primary)" }} />
            <h2>{pastaAtual?.nome ?? materiaAtual?.nome ?? "Matérias"}</h2>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {nivel.tipo === "raiz" && (
              <button
                type="button"
                className="chip chip-primario"
                onClick={aoCriarMateria}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  add
                </span>
                Nova matéria
              </button>
            )}

            {nivel.tipo === "raiz" && vazias > 0 && (
              <button
                type="button"
                className={`chip${mostrarVazias ? " chip-primario" : ""}`}
                onClick={() => setMostrarVazias((v) => !v)}
                aria-pressed={mostrarVazias}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {mostrarVazias ? "visibility_off" : "visibility"}
                </span>
                {mostrarVazias ? "Ocultar vazias" : `Mostrar vazias (${vazias})`}
              </button>
            )}
          </div>
        </div>

        {erro && (
          <p role="alert" style={{ color: "var(--error)", fontSize: 12, marginBottom: 16 }}>
            {erro}
          </p>
        )}

        {carregando ? (
          <div className="loading-container">
            <div className="spinner" />
          </div>
        ) : (
          <div className="library-grid">
            {nivel.tipo !== "raiz" && (
              <CardVoltar
                onClick={() =>
                  setNivel(
                    nivel.tipo === "pasta"
                      ? { tipo: "materia", materiaId: nivel.materiaId }
                      : { tipo: "raiz" },
                  )
                }
              />
            )}

            {/* Nível 1: matérias */}
            {nivel.tipo === "raiz" &&
              materiasVisiveis.map(({ materia, total }) => (
                <CardPasta
                  key={materia.id}
                  icone="school"
                  titulo={materia.nome}
                  subtitulo={plural(total)}
                  destaque={total > 0}
                  onClick={() => setNivel({ tipo: "materia", materiaId: materia.id })}
                />
              ))}

            {/* Nível 2: pastas da matéria */}
            {nivel.tipo === "materia" &&
              pastas
                .filter((p) => p.id_materia === nivel.materiaId)
                .map((p) => (
                  <CardPasta
                    key={p.id}
                    icone="folder"
                    titulo={p.nome}
                    subtitulo={plural(p.quantidade_arquivos || 0)}
                    destaque={(p.quantidade_arquivos || 0) > 0}
                    onClick={() =>
                      setNivel({ tipo: "pasta", materiaId: nivel.materiaId, pastaId: p.id })
                    }
                    onRenomear={() => aoRenomear(p)}
                    onExcluir={() => aoExcluir(p)}
                  />
                ))}

            {/* Nível 3: documentos da pasta */}
            {nivel.tipo === "pasta" &&
              conteudosDaPasta?.map((c) => (
                <Link
                  key={c.id}
                  href={`/summary/${c.id}`}
                  className="folder-card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="card-icon-container">
                    <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
                      description
                    </span>
                  </div>
                  <h3 className="card-title">
                    {(c.extracao_original || "Documento").split("\n")[0].slice(0, 22)}
                  </h3>
                  <p className="card-subtitle">
                    {c.resumo_ia ? "Resumo pronto" : "Sem resumo"}
                  </p>
                </Link>
              ))}

            <VazioSeNecessario
              nivel={nivel}
              materias={materias}
              pastas={pastas}
              conteudos={conteudosDaPasta}
            />
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function VazioSeNecessario({
  nivel,
  materias,
  pastas,
  conteudos,
}: {
  nivel: Nivel;
  materias: Materia[];
  pastas: Pasta[];
  conteudos: Conteudo[] | null;
}) {
  const vazio =
    (nivel.tipo === "raiz" && materias.length === 0) ||
    (nivel.tipo === "materia" &&
      pastas.filter((p) => p.id_materia === nivel.materiaId).length === 0) ||
    (nivel.tipo === "pasta" && conteudos?.length === 0);

  if (!vazio) return null;

  const texto =
    nivel.tipo === "raiz"
      ? "Nenhuma matéria encontrada."
      : nivel.tipo === "materia"
        ? "Nenhuma pasta nesta matéria."
        : "Nenhum documento nesta pasta.";

  return (
    <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, opacity: 0.5, fontSize: 13 }}>
      {texto}
    </p>
  );
}

function CardVoltar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="folder-card" onClick={onClick} aria-label="Voltar">
      <div className="card-icon-container">
        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
          arrow_back
        </span>
      </div>
      <h3 className="card-title">Voltar</h3>
    </button>
  );
}

function CardPasta({
  icone,
  titulo,
  subtitulo,
  destaque,
  onClick,
  onRenomear,
  onExcluir,
}: {
  icone: string;
  titulo: string;
  subtitulo: string;
  destaque?: boolean;
  onClick: () => void;
  onRenomear?: () => void;
  onExcluir?: () => void;
}) {
  return (
    <article
      className="folder-card"
      style={{
        position: "relative",
        borderColor: destaque ? "rgba(156,208,206,0.3)" : undefined,
      }}
    >
      {/* O botão cobre o card inteiro para a área de clique não depender de
          onClick numa <article>, que teclado e leitor de tela não alcançam. */}
      <button type="button" className="card-area-clique" onClick={onClick}>
        <span className="sr-only">{titulo}</span>
      </button>

      <div
        className="card-icon-container"
        style={destaque ? { background: "rgba(156,208,206,0.15)" } : undefined}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
          {icone}
        </span>
      </div>
      <h3 className="card-title">{titulo}</h3>
      <p className="card-subtitle">{subtitulo}</p>

      {(onRenomear || onExcluir) && (
        <div className="card-acoes">
          {onRenomear && (
            <button type="button" onClick={onRenomear} title="Renomear" aria-label={`Renomear ${titulo}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                edit
              </span>
            </button>
          )}
          {onExcluir && (
            <button
              type="button"
              onClick={onExcluir}
              title="Excluir"
              aria-label={`Excluir ${titulo}`}
              className="acao-perigo"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                delete
              </span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function FoldersPage() {
  return (
    <GuardaSessao>
      <FoldersConteudo />
    </GuardaSessao>
  );
}
