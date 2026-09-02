"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ConfirmarEventoCalendario from "@/components/ConfirmarEventoCalendario";
import GuardaSessao from "@/components/GuardaSessao";
import {
  criarEventoCalendario,
  excluirEventoCalendario,
  listarEventosCalendario,
  type EventoCalendario,
  type NovoEventoCalendario,
} from "@/lib/api";
import { avisar } from "@/lib/avisos";
import { rotuloTipoEvento } from "@/lib/calendario";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function isoLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function dataDoIso(valor: string): Date {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12);
}

function diasDoCalendario(referencia: Date) {
  const ano = referencia.getFullYear();
  const mes = referencia.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0);
  const total = Math.ceil((primeiro.getDay() + ultimo.getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, indice) => {
    const data = new Date(ano, mes, indice - primeiro.getDay() + 1, 12);
    return { data, iso: isoLocal(data), foraDoMes: data.getMonth() !== mes };
  });
}

function descricaoData(valor: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dataDoIso(valor));
}

function ordenarEventos(eventos: EventoCalendario[]): EventoCalendario[] {
  return [...eventos].sort((a, b) =>
    `${a.data}T${a.hora ?? "23:59"}`.localeCompare(`${b.data}T${b.hora ?? "23:59"}`),
  );
}

function tituloConteudoVinculado(texto: string | null, indice: number) {
  return texto?.split("\n").find((linha) => linha.trim())?.trim().slice(0, 70) || `Aula ${indice + 1}`;
}

function CalendarioConteudo() {
  const hoje = useMemo(() => new Date(), []);
  const hojeIso = isoLocal(hoje);
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [novoEventoAberto, setNovoEventoAberto] = useState(false);
  const [salvandoEvento, setSalvandoEvento] = useState(false);
  const [mesVisivel, setMesVisivel] = useState(
    () => new Date(hoje.getFullYear(), hoje.getMonth(), 1),
  );
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const buscarEventos = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setEventos(await listarEventosCalendario());
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    listarEventosCalendario()
      .then((itens) => {
        if (ativo) setEventos(itens);
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
  }, []);

  const dias = useMemo(() => diasDoCalendario(mesVisivel), [mesVisivel]);
  const quantidadePorDia = useMemo(() => {
    const mapa = new Map<string, number>();
    eventos.forEach((evento) => mapa.set(evento.data, (mapa.get(evento.data) ?? 0) + 1));
    return mapa;
  }, [eventos]);
  const eventosExibidos = useMemo(
    () =>
      diaSelecionado
        ? eventos.filter((evento) => evento.data === diaSelecionado)
        : eventos.filter((evento) => evento.data >= hojeIso),
    [diaSelecionado, eventos, hojeIso],
  );

  const tituloMes = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(mesVisivel);

  function mudarMes(delta: number) {
    setMesVisivel((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));
    setDiaSelecionado(null);
  }

  async function excluir(evento: EventoCalendario) {
    if (!confirm(`Excluir “${evento.titulo}” do calendário?`) || excluindoId) return;
    setExcluindoId(evento.id);
    try {
      await excluirEventoCalendario(evento.id);
      setEventos((atuais) => atuais.filter((item) => item.id !== evento.id));
      avisar("Evento removido do calendário.", "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setExcluindoId(null);
    }
  }

  async function salvarEventoManual(dados: NovoEventoCalendario) {
    if (salvandoEvento) return;
    setSalvandoEvento(true);
    try {
      const evento = await criarEventoCalendario(dados);
      setEventos((atuais) => ordenarEventos([...atuais, evento]));
      setDiaSelecionado(evento.data);
      const dataEvento = dataDoIso(evento.data);
      setMesVisivel(new Date(dataEvento.getFullYear(), dataEvento.getMonth(), 1));
      setNovoEventoAberto(false);
      avisar("Evento salvo no calendário.", "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setSalvandoEvento(false);
    }
  }

  return (
    <>
      <main className="container calendario-main">
        <section className="calendario-hero">
          <div>
            <span className="calendario-sobretitulo">Agenda acadêmica</span>
            <h1>Calendário</h1>
            <p>Crie um evento manualmente ou deixe o SCAN reconhecer a data para você.</p>
          </div>
          <div className="calendario-hero-acoes">
            <button
              type="button"
              className="calendario-novo-btn"
              onClick={() => setNovoEventoAberto(true)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              Novo evento
            </button>
            <Link href="/" className="calendario-capturar-btn">
              <span className="material-symbols-outlined" aria-hidden="true">document_scanner</span>
              Abrir SCAN
            </Link>
          </div>
        </section>

        <section className="calendario-painel" aria-label="Calendário mensal">
          <div className="calendario-mes-topo">
            <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <h2>{tituloMes}</h2>
            <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <div className="calendario-semana" aria-hidden="true">
            {DIAS_SEMANA.map((dia, indice) => <span key={`${dia}-${indice}`}>{dia}</span>)}
          </div>
          <div className="calendario-grade">
            {dias.map(({ data, iso, foraDoMes }) => {
              const quantidade = quantidadePorDia.get(iso) ?? 0;
              const selecionado = diaSelecionado === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`calendario-dia${foraDoMes ? " fora" : ""}${
                    iso === hojeIso ? " hoje" : ""
                  }${selecionado ? " selecionado" : ""}${quantidade ? " com-evento" : ""}`}
                  onClick={() => setDiaSelecionado(selecionado ? null : iso)}
                  aria-pressed={selecionado}
                  aria-label={`${descricaoData(iso)}${
                    quantidade ? `, ${quantidade} ${quantidade === 1 ? "evento" : "eventos"}` : ""
                  }`}
                >
                  <span>{data.getDate()}</span>
                  {quantidade > 0 && <i aria-hidden="true">{quantidade > 1 ? quantidade : ""}</i>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="calendario-agenda">
          <div className="calendario-agenda-topo">
            <div>
              <span className="calendario-sobretitulo">Sua agenda</span>
              <h2>{diaSelecionado ? descricaoData(diaSelecionado) : "Próximos eventos"}</h2>
            </div>
            {diaSelecionado && (
              <button type="button" className="link-limpo text-primary" onClick={() => setDiaSelecionado(null)}>
                Ver todos
              </button>
            )}
          </div>

          {carregando ? (
            <div className="calendario-vazio" role="status">
              <div className="spinner" />
              <p>Carregando eventos…</p>
            </div>
          ) : erro ? (
            <div className="calendario-vazio" role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
              <strong>Não foi possível carregar a agenda</strong>
              <p>{erro}</p>
              <button type="button" className="chip" onClick={() => void buscarEventos()}>Tentar novamente</button>
            </div>
          ) : eventosExibidos.length === 0 ? (
            <div className="calendario-vazio">
              <span className="material-symbols-outlined" aria-hidden="true">event_available</span>
              <strong>{diaSelecionado ? "Nenhum evento neste dia" : "Sua agenda está livre"}</strong>
              <p>Adicione manualmente ou use o SCAN para registrar uma prova, avaliação ou entrega.</p>
            </div>
          ) : (
            <div className="calendario-eventos">
              {eventosExibidos.map((evento) => (
                <article key={evento.id} className={`calendario-evento tipo-${evento.tipo}`}>
                  <Link href={`/calendar/${evento.id}`} className="calendario-evento-link">
                    <div className="calendario-evento-data" aria-hidden="true">
                      <strong>{dataDoIso(evento.data).getDate()}</strong>
                      <span>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(dataDoIso(evento.data)).replace(".", "")}</span>
                    </div>
                    <div className="calendario-evento-corpo">
                      <span className="calendario-evento-tipo">{rotuloTipoEvento(evento.tipo)}</span>
                      <h3>{evento.titulo}</h3>
                      <p>
                        {evento.hora ? `${evento.hora.slice(0, 5)} · ` : ""}
                        {evento.materia || descricaoData(evento.data)}
                      </p>
                      {evento.tema && <small><strong>Tema:</strong> {evento.tema}</small>}
                      {evento.assunto_sugerido && (
                        <small><strong>Foco sugerido:</strong> {evento.assunto_sugerido}</small>
                      )}
                      {evento.observacoes && <small>{evento.observacoes}</small>}
                      {evento.conteudos && evento.conteudos.length > 0 && (
                        <div className="calendario-evento-aulas" aria-label="Aulas vinculadas">
                          {evento.conteudos.map((conteudo, indice) => (
                            <span key={conteudo.id} className="calendario-evento-aula-badge">
                              <span className="material-symbols-outlined" aria-hidden="true">description</span>
                              {tituloConteudoVinculado(conteudo.extracao_original, indice)}
                            </span>
                          ))}
                        </div>
                      )}
                      {evento.trilha_estudo && evento.trilha_estudo.length > 0 && (
                        <div className="calendario-evento-trilha-badge">
                          <span className="material-symbols-outlined">route</span>
                          <span>Trilha de estudo · {evento.trilha_estudo.length} etapa{evento.trilha_estudo.length === 1 ? "" : "s"}</span>
                        </div>
                      )}
                      {evento.resumo_consolidado && (
                        <div className="calendario-evento-resumo-badge">
                          <span className="material-symbols-outlined">summarize</span>
                          <span>Com resumo consolidado</span>
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="calendario-evento-acoes">
                    <button
                      type="button"
                      onClick={() => void excluir(evento)}
                      disabled={excluindoId === evento.id}
                      aria-label={`Excluir ${evento.titulo}`}
                    >
                      <span className="material-symbols-outlined">
                        {excluindoId === evento.id ? "hourglass_top" : "delete"}
                      </span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {novoEventoAberto && (
        <ConfirmarEventoCalendario
          dataInicial={diaSelecionado ?? hojeIso}
          salvando={salvandoEvento}
          onCancelar={() => setNovoEventoAberto(false)}
          onConfirmar={salvarEventoManual}
        />
      )}

      <BottomNav />
    </>
  );
}

export default function CalendarioPage() {
  return (
    <GuardaSessao>
      <CalendarioConteudo />
    </GuardaSessao>
  );
}
