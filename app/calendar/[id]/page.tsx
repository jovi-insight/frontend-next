"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import GuardaSessao from "@/components/GuardaSessao";
import TrilhaEstudo from "@/components/TrilhaEstudo";
import FotoConteudoCalendario from "@/components/FotoConteudoCalendario";
import {
  obterEventoCalendario,
  gerarResumoConsolidado,
  excluirEventoCalendario,
  type EventoCalendario,
} from "@/lib/api";
import { avisar } from "@/lib/avisos";
import { rotuloTipoEvento } from "@/lib/calendario";
import "./detalhes-evento.css";

function dataDoIso(valor: string): Date {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12);
}

function formatarData(valor: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dataDoIso(valor));
}

function formatarHora(valor: string): string {
  return valor.slice(0, 5);
}

function tituloConteudoVinculado(texto: string | null, indice: number) {
  return texto?.split("\n").find((linha) => linha.trim())?.trim().slice(0, 70) || `Aula ${indice + 1}`;
}

function DetalhesEventoConteudo() {
  const params = useParams();
  const router = useRouter();
  const eventoId = params.id as string;

  const [evento, setEvento] = useState<EventoCalendario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    let ativo = true;
    obterEventoCalendario(eventoId)
      .then((dados) => {
        if (ativo) setEvento(dados);
      })
      .catch((e: Error) => {
        if (ativo) setErro(e.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [eventoId]);

  async function gerarResumo() {
    if (gerandoResumo || !evento) return;
    
    if (!evento.conteudos || evento.conteudos.length === 0) {
      avisar("Adicione conteúdos ao evento antes de gerar o resumo consolidado");
      return;
    }

    setGerandoResumo(true);
    try {
      const atualizado = await gerarResumoConsolidado(eventoId);
      setEvento(atualizado);
      avisar("Resumo consolidado gerado com sucesso!");
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setGerandoResumo(false);
    }
  }

  async function excluir() {
    if (!evento || excluindo) return;
    
    if (!confirm(`Excluir "${evento.titulo}" do calendário?`)) return;

    setExcluindo(true);
    try {
      await excluirEventoCalendario(eventoId);
      avisar("Evento excluído com sucesso");
      router.push("/calendar");
    } catch (e) {
      avisar((e as Error).message);
      setExcluindo(false);
    }
  }

  if (carregando) {
    return (
      <>
        <main className="detalhes-evento-loading">
          <span className="material-symbols-outlined rotating">progress_activity</span>
          <p>Carregando evento...</p>
        </main>
        <BottomNav />
      </>
    );
  }

  if (erro || !evento) {
    return (
      <>
        <main className="detalhes-evento-erro">
          <span className="material-symbols-outlined">error</span>
          <h2>Não foi possível carregar o evento</h2>
          <p>{erro || "Evento não encontrado"}</p>
          <Link href="/calendar" className="botao-voltar">
            Voltar ao calendário
          </Link>
        </main>
        <BottomNav />
      </>
    );
  }

  const conteudos = evento.conteudos ?? [];
  const temConteudos = conteudos.length > 0;
  const temTrilha = evento.trilha_estudo && evento.trilha_estudo.length > 0;

  return (
    <>
      <main className="detalhes-evento">
        <header className="detalhes-evento-header">
          <div className="detalhes-evento-header-topo">
            <Link href="/calendar" className="botao-voltar-icone">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <div className="detalhes-evento-acoes">
              <button
                type="button"
                onClick={() => router.push(`/calendar/${eventoId}/edit`)}
                aria-label="Editar evento"
              >
                <span className="material-symbols-outlined">edit</span>
              </button>
              <button
                type="button"
                onClick={() => void excluir()}
                disabled={excluindo}
                aria-label="Excluir evento"
              >
                <span className="material-symbols-outlined">
                  {excluindo ? "hourglass_top" : "delete"}
                </span>
              </button>
            </div>
          </div>
          
          <div className={`detalhes-evento-badge tipo-${evento.tipo}`}>
            {rotuloTipoEvento(evento.tipo)}
          </div>
          
          <h1>{evento.titulo}</h1>
          
          <div className="detalhes-evento-info">
            <div className="detalhes-evento-info-item">
              <span className="material-symbols-outlined">event</span>
              <span>{formatarData(evento.data)}</span>
            </div>
            {evento.hora && (
              <div className="detalhes-evento-info-item">
                <span className="material-symbols-outlined">schedule</span>
                <span>{formatarHora(evento.hora)}</span>
              </div>
            )}
            {evento.materia && (
              <div className="detalhes-evento-info-item">
                <span className="material-symbols-outlined">book</span>
                <span>{evento.materia}</span>
              </div>
            )}
          </div>
        </header>

        {evento.tema && (
          <section className="detalhes-evento-secao">
            <h2>
              <span className="material-symbols-outlined">label</span>
              Tema
            </h2>
            <p className="detalhes-evento-tema">{evento.tema}</p>
          </section>
        )}

        {evento.assunto_sugerido && (
          <section className="detalhes-evento-secao">
            <h2>
              <span className="material-symbols-outlined">lightbulb</span>
              Foco Sugerido
            </h2>
            <p className="detalhes-evento-foco">{evento.assunto_sugerido}</p>
          </section>
        )}

        {temConteudos && (
          <section className="detalhes-evento-secao">
            <h2>
              <span className="material-symbols-outlined">folder_open</span>
              Conteúdos Vinculados
              <span className="contador">{conteudos.length}</span>
            </h2>
            <div className="detalhes-evento-conteudos">
              {conteudos.map((conteudo, indice) => (
                <Link
                  key={conteudo.id}
                  href={`/summary/${conteudo.id}`}
                  className="detalhes-evento-conteudo-card"
                >
                  <FotoConteudoCalendario
                    url={conteudo.imagens?.[0]?.url_storage}
                    alt={`Foto de ${tituloConteudoVinculado(conteudo.extracao_original, indice)}`}
                    className="detalhes-evento-conteudo-foto"
                  />
                  <div className="detalhes-evento-conteudo-info">
                    <strong>{tituloConteudoVinculado(conteudo.extracao_original, indice)}</strong>
                    {conteudo.resumo_ia && (
                      <small className="conteudo-resumido">Com resumo IA</small>
                    )}
                  </div>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {temTrilha && (
          <section className="detalhes-evento-secao">
            <TrilhaEstudo trilha={evento.trilha_estudo} />
          </section>
        )}

        <section className="detalhes-evento-secao">
          <div className="detalhes-evento-secao-header">
            <h2>
              <span className="material-symbols-outlined">summarize</span>
              Resumo Consolidado
            </h2>
            {temConteudos && (
              <button
                type="button"
                onClick={() => void gerarResumo()}
                disabled={gerandoResumo}
                className="botao-gerar-resumo"
              >
                <span className="material-symbols-outlined">
                  {gerandoResumo ? "hourglass_top" : evento.resumo_consolidado ? "refresh" : "auto_awesome"}
                </span>
                {gerandoResumo ? "Gerando..." : evento.resumo_consolidado ? "Regerar" : "Gerar"}
              </button>
            )}
          </div>
          
          {evento.resumo_consolidado ? (
            <div className="detalhes-evento-resumo">
              <div className="resumo-conteudo">
                {evento.resumo_consolidado.split("\n").map((paragrafo, indice) => (
                  paragrafo.trim() && <p key={indice}>{paragrafo}</p>
                ))}
              </div>
            </div>
          ) : (
            <div className="detalhes-evento-resumo-vazio">
              <span className="material-symbols-outlined">description</span>
              {temConteudos ? (
                <>
                  <p>Nenhum resumo consolidado gerado ainda.</p>
                  <small>Clique em &quot;Gerar&quot; para criar um resumo focado para estudo.</small>
                </>
              ) : (
                <>
                  <p>Vincule conteúdos ao evento para gerar o resumo consolidado.</p>
                  <small>Edite o evento para adicionar aulas relacionadas.</small>
                </>
              )}
            </div>
          )}
        </section>

        {evento.observacoes && (
          <section className="detalhes-evento-secao">
            <h2>
              <span className="material-symbols-outlined">note</span>
              Observações
            </h2>
            <p className="detalhes-evento-observacoes">{evento.observacoes}</p>
          </section>
        )}
      </main>

      <BottomNav />
    </>
  );
}

export default function DetalhesEventoPage() {
  return (
    <GuardaSessao>
      <DetalhesEventoConteudo />
    </GuardaSessao>
  );
}
