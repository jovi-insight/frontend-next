"use client";

import { useState, type FormEvent } from "react";
import type {
  AnaliseEventoCalendario,
  NovoEventoCalendario,
  TipoEventoCalendario,
} from "@/lib/api";
import { TIPOS_EVENTO } from "@/lib/calendario";

export default function ConfirmarEventoCalendario({
  analise,
  imagem,
  salvando,
  onCancelar,
  onConfirmar,
}: {
  analise: AnaliseEventoCalendario;
  imagem: string;
  salvando: boolean;
  onCancelar: () => void;
  onConfirmar: (evento: NovoEventoCalendario) => void | Promise<void>;
}) {
  const [titulo, setTitulo] = useState(analise.titulo ?? "");
  const [tipo, setTipo] = useState<TipoEventoCalendario>(analise.tipo ?? "outro");
  const [data, setData] = useState(analise.data ?? "");
  const [hora, setHora] = useState(analise.hora ?? "");
  const [materia, setMateria] = useState(analise.materia ?? "");
  const [observacoes, setObservacoes] = useState(analise.observacoes ?? "");

  const precisaRevisao = !analise.data || analise.confianca === "baixa";

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void onConfirmar({
      titulo: titulo.trim(),
      tipo,
      data,
      hora: hora || null,
      materia: materia.trim() || null,
      observacoes: observacoes.trim() || null,
      texto_original: analise.texto_extraido || null,
    });
  }

  return (
    <div className="evento-confirmacao-overlay" role="dialog" aria-modal="true" aria-labelledby="evento-confirmacao-titulo">
      <form className="evento-confirmacao" onSubmit={enviar}>
        <header className="evento-confirmacao-topo">
          <div>
            <span className="calendario-sobretitulo">Detectado no SCAN</span>
            <h2 id="evento-confirmacao-titulo">Adicionar ao calendário?</h2>
          </div>
          <button type="button" onClick={onCancelar} disabled={salvando} aria-label="Continuar sem adicionar ao calendário">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

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
            <span>
              Revise título, data e horário. Nada será salvo no calendário sem sua confirmação.
            </span>
          </p>
        </div>

        <div className="evento-confirmacao-conteudo">
          <div className="evento-confirmacao-foto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagem} alt="Foto usada pela IA para propor o evento" />
            {analise.texto_extraido && (
              <details>
                <summary>Ver texto identificado</summary>
                <p>{analise.texto_extraido}</p>
              </details>
            )}
          </div>

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
              <select className="form-input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEventoCalendario)} disabled={salvando}>
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
              <input className="form-input" type="text" value={materia} onChange={(e) => setMateria(e.target.value)} placeholder="Opcional" maxLength={80} disabled={salvando} />
            </label>

            <label className="evento-campo evento-campo-largo">
              <span>Observações</span>
              <textarea className="form-input" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Sala, conteúdo ou instruções importantes" rows={3} maxLength={500} disabled={salvando} />
            </label>
          </div>
        </div>

        <footer className="evento-confirmacao-acoes">
          <button type="button" className="chip" onClick={onCancelar} disabled={salvando}>Agora não</button>
          <button type="submit" className="chip chip-primario" disabled={salvando || !titulo.trim() || !data}>
            <span className="material-symbols-outlined" aria-hidden="true">event_available</span>
            {salvando ? "Salvando…" : "Adicionar ao calendário"}
          </button>
        </footer>
      </form>
    </div>
  );
}
