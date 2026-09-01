"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import GuardaSessao from "@/components/GuardaSessao";
import {
  excluirEventoCalendario,
  listarEventosCalendario,
  type EventoCalendario,
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

function CalendarioConteudo() {
  const hoje = useMemo(() => new Date(), []);
  const hojeIso = isoLocal(hoje);
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
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

  return (
    <>
      <main className="container calendario-main">
        <section className="calendario-hero">
          <div>
            <span className="calendario-sobretitulo">Agenda acadêmica</span>
            <h1>Calendário</h1>
            <p>O SCAN reconhece datas junto com o conteúdo e pede sua confirmação antes de salvar.</p>
          </div>
          <Link href="/" className="calendario-capturar-btn">
            <span className="material-symbols-outlined" aria-hidden="true">document_scanner</span>
            Abrir SCAN
          </Link>
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
              <p>Use o SCAN para registrar a primeira prova, avaliação ou entrega.</p>
            </div>
          ) : (
            <div className="calendario-eventos">
              {eventosExibidos.map((evento) => (
                <article key={evento.id} className={`calendario-evento tipo-${evento.tipo}`}>
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
                    {evento.observacoes && <small>{evento.observacoes}</small>}
                  </div>
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
