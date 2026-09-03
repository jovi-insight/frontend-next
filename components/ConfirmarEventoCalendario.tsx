"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  listarRecursosCalendario,
  sugerirTrilhaCalendario,
  type AnaliseEventoCalendario,
  type EtapaTrilhaEstudo,
  type MateriaCalendario,
  type NovoEventoCalendario,
  type TipoEventoCalendario,
} from "@/lib/api";
import { TIPOS_EVENTO } from "@/lib/calendario";
import FotoConteudoCalendario from "@/components/FotoConteudoCalendario";
import SeletorLembretes from "@/components/SeletorLembretes";

function permitePlanejamento(tipo: TipoEventoCalendario) {
  return tipo === "prova" || tipo === "avaliacao";
}

export default function ConfirmarEventoCalendario({
  analise,
  imagem,
  dataInicial,
  salvando,
  onCancelar,
  onConfirmar,
}: {
  analise?: AnaliseEventoCalendario;
  imagem?: string;
  dataInicial?: string;
  salvando: boolean;
  onCancelar: () => void;
  onConfirmar: (evento: NovoEventoCalendario) => void | Promise<void>;
}) {
  const manual = !analise;
  const [titulo, setTitulo] = useState(analise?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoEventoCalendario>(analise?.tipo ?? "outro");
  const [data, setData] = useState(analise?.data ?? dataInicial ?? "");
  const [hora, setHora] = useState(analise?.hora ?? "");
  const [materia, setMateria] = useState(analise?.materia ?? "");
  const [materiaId, setMateriaId] = useState(analise?.materia_id ?? "");
  const [tema, setTema] = useState("");
  const [conteudoIds, setConteudoIds] = useState<string[]>([]);
  const [assuntoSugerido, setAssuntoSugerido] = useState("");
  const [trilhaEstudo, setTrilhaEstudo] = useState<EtapaTrilhaEstudo[]>([]);
  const [observacoes, setObservacoes] = useState(analise?.observacoes ?? "");
  const [lembretesMinutos, setLembretesMinutos] = useState<number[]>([1440]);
  const [recursos, setRecursos] = useState<MateriaCalendario[]>([]);
  const [carregandoRecursos, setCarregandoRecursos] = useState(true);
  const [erroRecursos, setErroRecursos] = useState<string | null>(null);
  const [sugerindo, setSugerindo] = useState(false);
  const [erroSugestao, setErroSugestao] = useState<string | null>(null);

  const materiaInicialId = analise?.materia_id ?? "";
  const materiaInicialNome = analise?.materia ?? "";
  useEffect(() => {
    let ativo = true;
    listarRecursosCalendario()
      .then((itens) => {
        if (!ativo) return;
        setRecursos(itens);
        setErroRecursos(null);
        setMateriaId((atual) => {
          if (atual && itens.some((item) => item.id === atual)) return atual;
          const encontrada = itens.find(
            (item) => item.nome.localeCompare(materiaInicialNome, "pt-BR", { sensitivity: "base" }) === 0,
          );
          return encontrada?.id ?? (itens.some((item) => item.id === materiaInicialId) ? materiaInicialId : "");
        });
      })
      .catch((erro: Error) => {
        if (ativo) setErroRecursos(erro.message);
      })
      .finally(() => {
        if (ativo) setCarregandoRecursos(false);
      });
    return () => {
      ativo = false;
    };
  }, [materiaInicialId, materiaInicialNome]);

  const precisaRevisao = Boolean(analise && (!analise.data || analise.confianca === "baixa"));
  const materiaSelecionada = useMemo(
    () => recursos.find((item) => item.id === materiaId) ?? null,
    [materiaId, recursos],
  );
  const materiaPersonalizada = Boolean(materia && !materiaSelecionada);
  const planejamentoAtivo = permitePlanejamento(tipo);

  function limparSugestao() {
    setAssuntoSugerido("");
    setTrilhaEstudo([]);
    setErroSugestao(null);
  }

  function alterarTipo(novoTipo: TipoEventoCalendario) {
    setTipo(novoTipo);
    if (!permitePlanejamento(novoTipo)) {
      setTema("");
      setConteudoIds([]);
      limparSugestao();
    }
  }

  function alterarMateria(novoId: string) {
    if (novoId === "__detectada__") return;
    const escolhida = recursos.find((item) => item.id === novoId);
    setMateriaId(escolhida?.id ?? "");
    setMateria(escolhida?.nome ?? "");
    setConteudoIds([]);
    limparSugestao();
  }

  function alterarTema(valor: string) {
    setTema(valor);
    if (assuntoSugerido || trilhaEstudo.length) limparSugestao();
  }

  function alternarConteudo(conteudoId: string) {
    setConteudoIds((atuais) =>
      atuais.includes(conteudoId)
        ? atuais.filter((id) => id !== conteudoId)
        : [...atuais, conteudoId],
    );
    limparSugestao();
  }

  async function sugerirTrilha() {
    if (!materiaId || tema.trim().length < 2 || sugerindo) return;
    setSugerindo(true);
    setErroSugestao(null);
    try {
      const sugestao = await sugerirTrilhaCalendario({
        materia_id: materiaId,
        tema: tema.trim(),
        conteudo_ids: conteudoIds,
      });
      setAssuntoSugerido(sugestao.assunto_sugerido);
      setTrilhaEstudo(sugestao.trilha_estudo);
    } catch (erro) {
      setErroSugestao((erro as Error).message);
    } finally {
      setSugerindo(false);
    }
  }

  function atualizarEtapa(indice: number, campos: Partial<EtapaTrilhaEstudo>) {
    setTrilhaEstudo((atuais) =>
      atuais.map((etapa, atual) => (atual === indice ? { ...etapa, ...campos } : etapa)),
    );
  }

  function adicionarEtapa() {
    setTrilhaEstudo((atuais) => [
      ...atuais,
      { titulo: "Nova etapa", objetivo: "Descreva o que estudar nesta etapa.", duracao_minutos: 30 },
    ]);
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void onConfirmar({
      titulo: titulo.trim(),
      tipo,
      data,
      hora: hora || null,
      materia: materia.trim() || null,
      materia_id: materiaId || null,
      tema: planejamentoAtivo ? tema.trim() || null : null,
      assunto_sugerido: planejamentoAtivo ? assuntoSugerido.trim() || null : null,
      trilha_estudo: planejamentoAtivo ? trilhaEstudo : [],
      lembretes_minutos: lembretesMinutos,
      conteudo_ids: planejamentoAtivo ? conteudoIds : [],
      observacoes: observacoes.trim() || null,
      texto_original: analise?.texto_extraido || null,
    });
  }

  return (
    <div className="evento-confirmacao-overlay" role="dialog" aria-modal="true" aria-labelledby="evento-confirmacao-titulo">
      <form className={`evento-confirmacao${manual ? " manual" : ""}`} onSubmit={enviar}>
        <header className="evento-confirmacao-topo">
          <div>
            <span className="calendario-sobretitulo">
              {manual ? "Novo compromisso" : "Detectado no SCAN"}
            </span>
            <h2 id="evento-confirmacao-titulo">
              {manual ? "Adicionar evento" : "Adicionar ao calendário?"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            disabled={salvando}
            aria-label={manual ? "Fechar novo evento" : "Continuar sem adicionar ao calendário"}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {!manual && (
          <div className={`evento-ia-status${precisaRevisao ? " revisar" : ""}`} role="status">
            <span className="material-symbols-outlined" aria-hidden="true">
              {precisaRevisao ? "edit_calendar" : "auto_awesome"}
            </span>
            <p>
              <strong>
                {precisaRevisao
                  ? "A IA não encontrou todos os dados com segurança"
                  : "O SCAN encontrou um possível evento"}
              </strong>
              <span>Revise os dados. Nada será salvo sem sua confirmação.</span>
            </p>
          </div>
        )}

        <div className={`evento-confirmacao-conteudo${manual ? " manual" : ""}`}>
          {imagem && (
            <div className="evento-confirmacao-foto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagem} alt="Foto usada pela IA para propor o evento" />
              {analise?.texto_extraido && (
                <details>
                  <summary>Ver texto identificado</summary>
                  <p>{analise.texto_extraido}</p>
                </details>
              )}
            </div>
          )}

          <div className="evento-confirmacao-campos">
            <label className="evento-campo evento-campo-largo">
              <span>Título *</span>
              <input
                className="form-input"
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Prova de Matemática"
                autoFocus
                required
                maxLength={100}
                disabled={salvando}
              />
            </label>

            <label className="evento-campo">
              <span>Tipo</span>
              <select className="form-input" value={tipo} onChange={(e) => alterarTipo(e.target.value as TipoEventoCalendario)} disabled={salvando}>
                {TIPOS_EVENTO.map((item) => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
              </select>
            </label>

            <label className="evento-campo">
              <span>Data *</span>
              <input className="form-input" type="date" value={data} onChange={(e) => setData(e.target.value)} required disabled={salvando} />
            </label>

            <label className="evento-campo">
              <span>Horário</span>
              <input className="form-input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={salvando} />
            </label>

            <label className="evento-campo">
              <span>Matéria</span>
              <select
                className="form-input"
                value={materiaId || (materiaPersonalizada ? "__detectada__" : "")}
                onChange={(e) => alterarMateria(e.target.value)}
                disabled={salvando || carregandoRecursos}
              >
                <option value="">Nenhuma matéria</option>
                {materiaPersonalizada && <option value="__detectada__">{materia} (detectada pelo SCAN)</option>}
                {recursos.length > 0 ? (
                  recursos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome} ({item.aulas.length} aula{item.aulas.length === 1 ? "" : "s"})
                    </option>
                  ))
                ) : carregandoRecursos ? (
                  <option value="" disabled>Carregando matérias...</option>
                ) : (
                  <option value="" disabled>Nenhuma matéria encontrada</option>
                )}
              </select>
            </label>

            {!carregandoRecursos && recursos.length === 0 && !materiaPersonalizada && (
              <p className="evento-campo-info evento-campo-largo">
                💡 Você ainda não possui matérias com conteúdos salvos. Capture aulas primeiro no Dashboard para vinculá-las aos eventos.
              </p>
            )}

            {erroRecursos && <p className="evento-campo-erro evento-campo-largo">{erroRecursos}</p>}

            <label className="evento-campo evento-campo-largo">
              <span>Observações</span>
              <textarea className="form-input" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Sala, conteúdo ou instruções importantes" rows={3} maxLength={500} disabled={salvando} />
            </label>
          </div>
        </div>

        <SeletorLembretes
          valores={lembretesMinutos}
          onChange={setLembretesMinutos}
          disabled={salvando}
        />

        {planejamentoAtivo && (
          <section className="evento-planejamento" aria-labelledby="evento-planejamento-titulo">
            <header>
              <div>
                <span className="calendario-sobretitulo">Preparação para a prova</span>
                <h3 id="evento-planejamento-titulo">Tema, aulas e trilha de estudo</h3>
              </div>
              <span className="material-symbols-outlined" aria-hidden="true">route</span>
            </header>

            <label className="evento-campo">
              <span>Tema que será cobrado</span>
              <input
                className="form-input"
                value={tema}
                onChange={(e) => alterarTema(e.target.value)}
                placeholder="Ex.: Funções do 2º grau e gráficos"
                maxLength={200}
                disabled={salvando}
              />
            </label>

            <div className="evento-aulas">
              <div className="evento-aulas-topo">
                <strong>Vincular fotos ou aulas salvas</strong>
                {conteudoIds.length > 0 && <span>{conteudoIds.length} selecionada{conteudoIds.length === 1 ? "" : "s"}</span>}
              </div>
              {carregandoRecursos ? (
                <p className="evento-campo-info">Carregando suas aulas...</p>
              ) : !materiaId ? (
                <p className="evento-campo-info">
                  👆 Selecione uma matéria acima para visualizar as aulas disponíveis.
                </p>
              ) : materiaSelecionada?.aulas.length ? (
                <div className="evento-aulas-lista">
                  {materiaSelecionada.aulas.map((aula) => (
                    <label key={aula.id} className="evento-aula-opcao">
                      <input
                        type="checkbox"
                        checked={conteudoIds.includes(aula.id)}
                        onChange={() => alternarConteudo(aula.id)}
                        disabled={salvando || sugerindo}
                      />
                      <FotoConteudoCalendario
                        url={aula.imagem_url}
                        alt={`Foto de ${aula.titulo}`}
                        className="evento-aula-foto"
                      />
                      <span>
                        <strong>{aula.titulo}</strong>
                        <small>
                          {aula.pasta_nome}
                          {aula.quantidade_imagens > 1
                            ? ` · ${aula.quantidade_imagens} fotos`
                            : ""}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="evento-campo-info">
                  📚 A matéria &quot;{materiaSelecionada?.nome}&quot; ainda não possui aulas salvas. 
                  Capture conteúdos no Dashboard para vinculá-los aqui.
                </p>
              )}
            </div>

            <button
              type="button"
              className="evento-sugerir-btn"
              onClick={() => void sugerirTrilha()}
              disabled={salvando || sugerindo || !materiaId || tema.trim().length < 2}
            >
              <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
              {sugerindo ? "Montando trilha…" : "Sugerir assunto e trilha com IA"}
            </button>
            {erroSugestao && <p className="evento-campo-erro" role="alert">{erroSugestao}</p>}

            {(assuntoSugerido || trilhaEstudo.length > 0) && (
              <div className="evento-trilha-edicao">
                <label className="evento-campo">
                  <span>Assunto sugerido</span>
                  <textarea
                    className="form-input"
                    value={assuntoSugerido}
                    onChange={(e) => setAssuntoSugerido(e.target.value)}
                    rows={2}
                    maxLength={500}
                    disabled={salvando}
                  />
                </label>

                <div className="evento-trilha-topo">
                  <strong>Etapas da trilha</strong>
                  <button type="button" onClick={adicionarEtapa} disabled={salvando || trilhaEstudo.length >= 10}>Adicionar etapa</button>
                </div>
                {trilhaEstudo.map((etapa, indice) => (
                  <article key={indice} className="evento-etapa-edicao">
                    <span>{indice + 1}</span>
                    <div>
                      <input
                        className="form-input"
                        aria-label={`Título da etapa ${indice + 1}`}
                        value={etapa.titulo}
                        onChange={(e) => atualizarEtapa(indice, { titulo: e.target.value })}
                        maxLength={100}
                        required
                        disabled={salvando}
                      />
                      <textarea
                        className="form-input"
                        aria-label={`Objetivo da etapa ${indice + 1}`}
                        value={etapa.objetivo}
                        onChange={(e) => atualizarEtapa(indice, { objetivo: e.target.value })}
                        rows={2}
                        maxLength={500}
                        required
                        disabled={salvando}
                      />
                      <label>
                        <span>Duração</span>
                        <input
                          className="form-input"
                          type="number"
                          min={5}
                          max={240}
                          value={etapa.duracao_minutos}
                          onChange={(e) => atualizarEtapa(indice, { duracao_minutos: Number(e.target.value) })}
                          aria-label={`Duração da etapa ${indice + 1} em minutos`}
                          required
                          disabled={salvando}
                        />
                        <small>min</small>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTrilhaEstudo((atuais) => atuais.filter((_, atual) => atual !== indice))}
                      aria-label={`Remover etapa ${indice + 1}`}
                      disabled={salvando}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="evento-confirmacao-acoes">
          <button type="button" className="chip" onClick={onCancelar} disabled={salvando}>
            {manual ? "Cancelar" : "Agora não"}
          </button>
          <button type="submit" className="chip chip-primario" disabled={salvando || sugerindo || !titulo.trim() || !data}>
            <span className="material-symbols-outlined" aria-hidden="true">event_available</span>
            {salvando ? "Salvando…" : manual ? "Salvar evento" : "Adicionar ao calendário"}
          </button>
        </footer>
      </form>
    </div>
  );
}
