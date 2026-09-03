"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ConfirmarEventoCalendario from "@/components/ConfirmarEventoCalendario";
import FotoConteudoCalendario from "@/components/FotoConteudoCalendario";
import GuardaSessao from "@/components/GuardaSessao";
import {
  criarEventoCalendario,
  excluirEventoCalendario,
  listarEventosCalendario,
  type EventoCalendario,
  type NovoEventoCalendario,
  type TipoEventoCalendario,
} from "@/lib/api";
import { avisar } from "@/lib/avisos";
import { TIPOS_EVENTO, rotuloLembrete, rotuloTipoEvento } from "@/lib/calendario";

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

function diferencaDias(data: string, referencia: string): number {
  const atual = dataDoIso(referencia).getTime();
  const destino = dataDoIso(data).getTime();
  return Math.round((destino - atual) / 86_400_000);
}

function rotuloPrazo(data: string, referencia: string): string {
  const dias = diferencaDias(data, referencia);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias > 1) return `Em ${dias} dias`;
  if (dias === -1) return "Ontem";
  return `Há ${Math.abs(dias)} dias`;
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
  const [visao, setVisao] = useState<"mes" | "agenda">("mes");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoEventoCalendario>("todos");
  const [filtroMateria, setFiltroMateria] = useState("todas");

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

  const materias = useMemo(
    () => [...new Set(eventos.map((evento) => evento.materia).filter(Boolean) as string[])].sort(
      (a, b) => a.localeCompare(b, "pt-BR"),
    ),
    [eventos],
  );
  const eventosFiltrados = useMemo(
    () =>
      eventos.filter(
        (evento) =>
          (filtroTipo === "todos" || evento.tipo === filtroTipo) &&
          (filtroMateria === "todas" || evento.materia === filtroMateria),
      ),
    [eventos, filtroMateria, filtroTipo],
  );
  const dias = useMemo(() => diasDoCalendario(mesVisivel), [mesVisivel]);
  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>();
    eventosFiltrados.forEach((evento) => mapa.set(evento.data, [...(mapa.get(evento.data) ?? []), evento]));
    return mapa;
  }, [eventosFiltrados]);
  const eventosExibidos = useMemo(
    () =>
      diaSelecionado
        ? eventosFiltrados.filter((evento) => evento.data === diaSelecionado)
        : eventosFiltrados.filter((evento) => evento.data >= hojeIso),
    [diaSelecionado, eventosFiltrados, hojeIso],
  );
  const eventosFuturos = useMemo(
    () => ordenarEventos(eventos.filter((evento) => evento.data >= hojeIso)),
    [eventos, hojeIso],
  );
  const proximoEvento = eventosFuturos[0] ?? null;
  const limiteSeteDias = useMemo(() => {
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 7);
    return isoLocal(limite);
  }, [hoje]);
  const proximosSeteDias = eventosFuturos.filter((evento) => evento.data <= limiteSeteDias).length;
  const lembretesAtivos = eventosFuturos.reduce(
    (total, evento) => total + (evento.lembretes_minutos?.length ?? 0),
    0,
  );
  const prefixoMes = `${mesVisivel.getFullYear()}-${String(mesVisivel.getMonth() + 1).padStart(2, "0")}`;
  const eventosNoMes = eventosFiltrados.filter((evento) => evento.data.startsWith(prefixoMes)).length;

  const tituloMes = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(mesVisivel);

  function mudarMes(delta: number) {
    setMesVisivel((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));
    setDiaSelecionado(null);
  }

  function irParaHoje() {
    setMesVisivel(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    setDiaSelecionado(hojeIso);
    setVisao("mes");
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

        <section className="calendario-resumo" aria-label="Resumo da agenda">
          {proximoEvento ? (
            <Link
              href={`/calendar/${proximoEvento.id}`}
              className={`calendario-proximo tipo-${proximoEvento.tipo}`}
            >
              <div className="calendario-proximo-icone">
                <span className="material-symbols-outlined" aria-hidden="true">upcoming</span>
              </div>
              <div>
                <span>Próximo compromisso</span>
                <strong>{proximoEvento.titulo}</strong>
                <small>
                  {rotuloPrazo(proximoEvento.data, hojeIso)}
                  {proximoEvento.materia ? ` · ${proximoEvento.materia}` : ""}
                </small>
              </div>
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </Link>
          ) : (
            <button type="button" className="calendario-proximo vazio" onClick={() => setNovoEventoAberto(true)}>
              <div className="calendario-proximo-icone">
                <span className="material-symbols-outlined" aria-hidden="true">event_available</span>
              </div>
              <div>
                <span>Próximo compromisso</span>
                <strong>Agenda livre</strong>
                <small>Toque para adicionar um evento</small>
              </div>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
            </button>
          )}
          <div className="calendario-indicadores">
            <article>
              <span className="material-symbols-outlined" aria-hidden="true">date_range</span>
              <div><strong>{eventosNoMes}</strong><small>neste mês</small></div>
            </article>
            <article>
              <span className="material-symbols-outlined" aria-hidden="true">pace</span>
              <div><strong>{proximosSeteDias}</strong><small>nos próximos 7 dias</small></div>
            </article>
            <article>
              <span className="material-symbols-outlined" aria-hidden="true">notifications_active</span>
              <div><strong>{lembretesAtivos}</strong><small>lembretes ativos</small></div>
            </article>
          </div>
        </section>

        <section className="calendario-controles" aria-label="Visualização e filtros">
          <div className="calendario-visoes" aria-label="Visualização">
            <button type="button" className={visao === "mes" ? "ativo" : ""} aria-pressed={visao === "mes"} onClick={() => setVisao("mes")}>
              <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
              Mês
            </button>
            <button type="button" className={visao === "agenda" ? "ativo" : ""} aria-pressed={visao === "agenda"} onClick={() => { setVisao("agenda"); setDiaSelecionado(null); }}>
              <span className="material-symbols-outlined" aria-hidden="true">view_agenda</span>
              Agenda
            </button>
          </div>

          <div className="calendario-filtros-tipo" aria-label="Filtrar por tipo">
            <button type="button" className={filtroTipo === "todos" ? "ativo" : ""} aria-pressed={filtroTipo === "todos"} onClick={() => setFiltroTipo("todos")}>Todos</button>
            {TIPOS_EVENTO.slice(0, 4).map((item) => (
              <button key={item.valor} type="button" className={`tipo-${item.valor}${filtroTipo === item.valor ? " ativo" : ""}`} aria-pressed={filtroTipo === item.valor} onClick={() => setFiltroTipo(item.valor)}>
                {item.rotulo}
              </button>
            ))}
          </div>

          <div className="calendario-filtros-finais">
            <label>
              <span className="material-symbols-outlined" aria-hidden="true">menu_book</span>
              <select value={filtroMateria} onChange={(e) => setFiltroMateria(e.target.value)} aria-label="Filtrar por matéria">
                <option value="todas">Todas as matérias</option>
                {materias.map((materia) => <option key={materia} value={materia}>{materia}</option>)}
              </select>
            </label>
            <button type="button" onClick={irParaHoje}>Hoje</button>
          </div>
        </section>

        {visao === "mes" && (
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
                const eventosDia = eventosPorDia.get(iso) ?? [];
                const quantidade = eventosDia.length;
                const tipos = [...new Set(eventosDia.map((evento) => evento.tipo))].slice(0, 3);
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
                    {quantidade > 0 && (
                      <span className="calendario-dia-eventos" aria-hidden="true">
                        {tipos.map((tipo) => <i key={tipo} className={`tipo-${tipo}`} />)}
                        {quantidade > 3 && <b>+{quantidade - 3}</b>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="calendario-agenda">
          <div className="calendario-agenda-topo">
            <div>
              <span className="calendario-sobretitulo">Sua agenda</span>
              <h2>{diaSelecionado ? descricaoData(diaSelecionado) : visao === "agenda" ? "Agenda completa" : "Próximos eventos"}</h2>
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
              <span className="material-symbols-outlined" aria-hidden="true">
                {filtroTipo !== "todos" || filtroMateria !== "todas" ? "filter_alt_off" : "event_available"}
              </span>
              <strong>
                {filtroTipo !== "todos" || filtroMateria !== "todas"
                  ? "Nenhum evento com esses filtros"
                  : diaSelecionado
                    ? "Nenhum evento neste dia"
                    : "Sua agenda está livre"}
              </strong>
              <p>
                {filtroTipo !== "todos" || filtroMateria !== "todas"
                  ? "Limpe os filtros para visualizar toda a sua agenda."
                  : "Adicione manualmente ou use o SCAN para registrar uma prova, avaliação ou entrega."}
              </p>
              {(filtroTipo !== "todos" || filtroMateria !== "todas") && (
                <button type="button" className="chip" onClick={() => { setFiltroTipo("todos"); setFiltroMateria("todas"); }}>
                  Limpar filtros
                </button>
              )}
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
                      <div className="calendario-evento-meta-topo">
                        <span className="calendario-evento-tipo">{rotuloTipoEvento(evento.tipo)}</span>
                        <span className={`calendario-evento-prazo${diferencaDias(evento.data, hojeIso) <= 3 ? " urgente" : ""}`}>
                          {rotuloPrazo(evento.data, hojeIso)}
                        </span>
                      </div>
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
                              <FotoConteudoCalendario
                                url={conteudo.imagens?.[0]?.url_storage}
                                alt=""
                                className="calendario-evento-aula-foto"
                              />
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
                      {evento.lembretes_minutos?.length > 0 && (
                        <div className="calendario-evento-lembrete-badge">
                          <span className="material-symbols-outlined">notifications_active</span>
                          <span>
                            {rotuloLembrete(evento.lembretes_minutos[0])}
                            {evento.lembretes_minutos.length > 1
                              ? ` +${evento.lembretes_minutos.length - 1}`
                              : ""}
                          </span>
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
