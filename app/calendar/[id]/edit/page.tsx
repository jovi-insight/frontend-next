"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import GuardaSessao from "@/components/GuardaSessao";
import FotoConteudoCalendario from "@/components/FotoConteudoCalendario";
import {
  obterEventoCalendario,
  atualizarEventoCalendario,
  listarRecursosCalendario,
  sugerirTrilhaCalendario,
  type EtapaTrilhaEstudo,
  type MateriaCalendario,
  type TipoEventoCalendario,
} from "@/lib/api";
import { avisar } from "@/lib/avisos";
import { TIPOS_EVENTO } from "@/lib/calendario";
import "./editar-evento.css";

function permitePlanejamento(tipo: TipoEventoCalendario) {
  return tipo === "prova" || tipo === "avaliacao";
}

function EditarEventoConteudo() {
  const params = useParams();
  const router = useRouter();
  const eventoId = params.id as string;

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoEventoCalendario>("outro");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [tema, setTema] = useState("");
  const [conteudoIds, setConteudoIds] = useState<string[]>([]);
  const [assuntoSugerido, setAssuntoSugerido] = useState("");
  const [trilhaEstudo, setTrilhaEstudo] = useState<EtapaTrilhaEstudo[]>([]);
  const [observacoes, setObservacoes] = useState("");

  const [recursos, setRecursos] = useState<MateriaCalendario[]>([]);
  const [carregandoRecursos, setCarregandoRecursos] = useState(true);
  const [sugerindo, setSugerindo] = useState(false);
  const [erroSugestao, setErroSugestao] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    obterEventoCalendario(eventoId)
      .then((dados) => {
        if (!ativo) return;
      setTitulo(dados.titulo);
      setTipo(dados.tipo);
      setData(dados.data);
      setHora(dados.hora || "");
      setMateriaId(dados.materia_id || "");
      setTema(dados.tema || "");
      setAssuntoSugerido(dados.assunto_sugerido || "");
      setTrilhaEstudo(dados.trilha_estudo || []);
      setObservacoes(dados.observacoes || "");
      setConteudoIds(dados.conteudos?.map((c) => c.id) || []);
      })
      .catch((e: Error) => {
        if (!ativo) return;
        avisar(e.message, "erro");
        router.push("/calendar");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [eventoId, router]);

  useEffect(() => {
    let ativo = true;
    listarRecursosCalendario()
      .then((itens) => {
        if (ativo) setRecursos(itens);
      })
      .catch((erro: Error) => {
        if (ativo) avisar(erro.message);
      })
      .finally(() => {
        if (ativo) setCarregandoRecursos(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const materiaSelecionada = recursos.find((item) => item.id === materiaId) ?? null;
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
    setMateriaId(novoId);
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

  function removerEtapa(indice: number) {
    setTrilhaEstudo((atuais) => atuais.filter((_, atual) => atual !== indice));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;

    setSalvando(true);
    try {
      await atualizarEventoCalendario(eventoId, {
        titulo: titulo.trim(),
        tipo,
        data,
        hora: hora || null,
        materia_id: materiaId || null,
        tema: tema.trim() || null,
        assunto_sugerido: assuntoSugerido.trim() || null,
        trilha_estudo: trilhaEstudo.length > 0 ? trilhaEstudo : [],
        conteudo_ids: conteudoIds,
        observacoes: observacoes.trim() || null,
      });
      avisar("Evento atualizado com sucesso!");
      router.push(`/calendar/${eventoId}`);
    } catch (erro) {
      avisar((erro as Error).message);
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="editar-evento-loading">
        <span className="material-symbols-outlined rotating">progress_activity</span>
        <p>Carregando evento...</p>
      </main>
    );
  }

  return (
    <main className="editar-evento">
      <header className="editar-evento-header">
        <Link href={`/calendar/${eventoId}`} className="botao-voltar-icone">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1>Editar Evento</h1>
      </header>

      <form onSubmit={salvar} className="editar-evento-form">
        <div className="form-grupo">
          <label htmlFor="titulo">
            Título <span className="obrigatorio">*</span>
          </label>
          <input
            id="titulo"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            maxLength={100}
            placeholder="Ex: Prova de Matemática"
          />
        </div>

        <div className="form-grupo">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" value={tipo} onChange={(e) => alterarTipo(e.target.value as TipoEventoCalendario)}>
            {TIPOS_EVENTO.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="form-linha">
          <div className="form-grupo">
            <label htmlFor="data">
              Data <span className="obrigatorio">*</span>
            </label>
            <input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
            />
          </div>

          <div className="form-grupo">
            <label htmlFor="hora">Horário</label>
            <input
              id="hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grupo">
          <label htmlFor="materia">Matéria</label>
          {carregandoRecursos ? (
            <p className="form-info">Carregando matérias...</p>
          ) : recursos.length === 0 ? (
            <p className="form-aviso">Nenhuma matéria encontrada. Crie pastas no dashboard primeiro.</p>
          ) : (
            <select id="materia" value={materiaId} onChange={(e) => alterarMateria(e.target.value)}>
              <option value="">Nenhuma</option>
              {recursos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} ({item.aulas.length} aula{item.aulas.length === 1 ? "" : "s"})
                </option>
              ))}
            </select>
          )}
        </div>

        {planejamentoAtivo && materiaSelecionada && (
          <>
            <div className="form-grupo">
              <label htmlFor="tema">Tema da avaliação</label>
              <input
                id="tema"
                type="text"
                value={tema}
                onChange={(e) => alterarTema(e.target.value)}
                maxLength={200}
                placeholder="Ex: Funções quadráticas e equações do 2º grau"
              />
            </div>

            {materiaSelecionada.aulas.length > 0 && (
              <div className="form-grupo">
                <label>Vincular fotos ou aulas salvas</label>
                <div className="form-checkbox-grupo">
                  {materiaSelecionada.aulas.map((aula) => (
                    <label key={aula.id} className="form-checkbox-item">
                      <input
                        type="checkbox"
                        checked={conteudoIds.includes(aula.id)}
                        onChange={() => alternarConteudo(aula.id)}
                      />
                      <FotoConteudoCalendario
                        url={aula.imagem_url}
                        alt={`Foto de ${aula.titulo}`}
                        className="form-checkbox-foto"
                      />
                      <span className="form-checkbox-texto">
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
              </div>
            )}

            {tema.trim().length >= 2 && (
              <div className="form-secao-trilha">
                <div className="form-secao-trilha-header">
                  <h3>Trilha de Estudo</h3>
                  <button
                    type="button"
                    onClick={() => void sugerirTrilha()}
                    disabled={sugerindo}
                    className="botao-sugerir"
                  >
                    <span className="material-symbols-outlined">
                      {sugerindo ? "hourglass_top" : "auto_awesome"}
                    </span>
                    {sugerindo ? "Gerando..." : trilhaEstudo.length > 0 ? "Regerar" : "Sugerir com IA"}
                  </button>
                </div>

                {erroSugestao && <p className="form-erro">{erroSugestao}</p>}

                {assuntoSugerido && (
                  <div className="form-grupo">
                    <label htmlFor="assunto-sugerido">Foco sugerido</label>
                    <input
                      id="assunto-sugerido"
                      type="text"
                      value={assuntoSugerido}
                      onChange={(e) => setAssuntoSugerido(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                )}

                {trilhaEstudo.length > 0 && (
                  <div className="form-trilha-etapas">
                    {trilhaEstudo.map((etapa, indice) => (
                      <div key={indice} className="form-trilha-etapa">
                        <div className="form-trilha-etapa-header">
                          <strong>Etapa {indice + 1}</strong>
                          <button
                            type="button"
                            onClick={() => removerEtapa(indice)}
                            className="botao-remover-etapa"
                          >
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={etapa.titulo}
                          onChange={(e) => atualizarEtapa(indice, { titulo: e.target.value })}
                          placeholder="Título da etapa"
                          maxLength={100}
                        />
                        <textarea
                          value={etapa.objetivo}
                          onChange={(e) => atualizarEtapa(indice, { objetivo: e.target.value })}
                          placeholder="Objetivo da etapa"
                          maxLength={500}
                          rows={2}
                        />
                        <div className="form-trilha-duracao">
                          <label>Duração (minutos)</label>
                          <input
                            type="number"
                            value={etapa.duracao_minutos}
                            onChange={(e) =>
                              atualizarEtapa(indice, { duracao_minutos: parseInt(e.target.value) || 5 })
                            }
                            min={5}
                            max={240}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="form-grupo">
          <label htmlFor="observacoes">Observações</label>
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Informações adicionais sobre o evento"
          />
        </div>

        <div className="form-acoes">
          <button
            type="button"
            onClick={() => router.push(`/calendar/${eventoId}`)}
            className="botao-secundario"
            disabled={salvando}
          >
            Cancelar
          </button>
          <button type="submit" className="botao-primario" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function EditarEventoPage() {
  return (
    <GuardaSessao>
      <EditarEventoConteudo />
    </GuardaSessao>
  );
}
