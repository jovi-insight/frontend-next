"use client";

import { useState } from "react";
import type { EtapaTrilhaEstudo } from "@/lib/api";
import "./TrilhaEstudo.css";

interface TrilhaEstudoProps {
  trilha: EtapaTrilhaEstudo[];
  compacta?: boolean;
}

export default function TrilhaEstudo({ trilha, compacta = false }: TrilhaEstudoProps) {
  const [etapasCompletas, setEtapasCompletas] = useState<Set<number>>(new Set());

  function toggleEtapa(indice: number) {
    setEtapasCompletas((atual) => {
      const nova = new Set(atual);
      if (nova.has(indice)) {
        nova.delete(indice);
      } else {
        nova.add(indice);
      }
      return nova;
    });
  }

  const totalMinutos = trilha.reduce((acc, etapa) => acc + etapa.duracao_minutos, 0);
  const minutosCompletos = trilha.reduce(
    (acc, etapa, idx) => acc + (etapasCompletas.has(idx) ? etapa.duracao_minutos : 0),
    0
  );
  const progresso = trilha.length > 0 ? (etapasCompletas.size / trilha.length) * 100 : 0;

  if (compacta) {
    return (
      <div className="trilha-estudo-compacta">
        <div className="trilha-compacta-header">
          <div className="trilha-compacta-info">
            <span className="material-symbols-outlined">route</span>
            <span>
              {trilha.length} etapa{trilha.length === 1 ? "" : "s"} · {totalMinutos} min
            </span>
          </div>
          {etapasCompletas.size > 0 && (
            <span className="trilha-compacta-progresso">
              {etapasCompletas.size}/{trilha.length} completas
            </span>
          )}
        </div>
        <div className="trilha-compacta-lista">
          {trilha.map((etapa, indice) => (
            <div
              key={`${indice}-${etapa.titulo}`}
              className={`trilha-compacta-etapa ${etapasCompletas.has(indice) ? "completa" : ""}`}
            >
              <button
                type="button"
                onClick={() => toggleEtapa(indice)}
                className="trilha-compacta-checkbox"
                aria-label={`Marcar ${etapa.titulo} como ${etapasCompletas.has(indice) ? "incompleta" : "completa"}`}
              >
                <span className="material-symbols-outlined">
                  {etapasCompletas.has(indice) ? "check_circle" : "radio_button_unchecked"}
                </span>
              </button>
              <div className="trilha-compacta-conteudo">
                <strong>{etapa.titulo}</strong>
                <span className="trilha-compacta-duracao">{etapa.duracao_minutos} min</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="trilha-estudo">
      <div className="trilha-estudo-header">
        <div className="trilha-estudo-info">
          <h3>
            <span className="material-symbols-outlined">route</span>
            Trilha de Estudo
          </h3>
          <div className="trilha-estudo-stats">
            <span className="trilha-stat">
              <span className="material-symbols-outlined">list</span>
              {trilha.length} etapa{trilha.length === 1 ? "" : "s"}
            </span>
            <span className="trilha-stat">
              <span className="material-symbols-outlined">schedule</span>
              {totalMinutos} min total
            </span>
          </div>
        </div>
        {etapasCompletas.size > 0 && (
          <div className="trilha-estudo-progresso-box">
            <div className="trilha-progresso-texto">
              <strong>{Math.round(progresso)}%</strong>
              <span>
                {minutosCompletos}/{totalMinutos} min
              </span>
            </div>
            <div className="trilha-progresso-barra">
              <div className="trilha-progresso-preenchimento" style={{ width: `${progresso}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="trilha-estudo-etapas">
        {trilha.map((etapa, indice) => {
          const completa = etapasCompletas.has(indice);
          const anterior = indice === 0 || etapasCompletas.has(indice - 1);
          const bloqueada = !anterior && indice > 0;

          return (
            <div
              key={`${indice}-${etapa.titulo}`}
              className={`trilha-etapa ${completa ? "completa" : ""} ${bloqueada ? "bloqueada" : ""}`}
            >
              <div className="trilha-etapa-lateral">
                <button
                  type="button"
                  onClick={() => toggleEtapa(indice)}
                  disabled={bloqueada}
                  className="trilha-etapa-checkbox"
                  aria-label={`Marcar etapa ${indice + 1} como ${completa ? "incompleta" : "completa"}`}
                >
                  <span className="material-symbols-outlined">
                    {completa ? "check_circle" : bloqueada ? "lock" : "radio_button_unchecked"}
                  </span>
                </button>
                {indice < trilha.length - 1 && <div className="trilha-etapa-linha" />}
              </div>

              <div className="trilha-etapa-conteudo">
                <div className="trilha-etapa-header">
                  <div className="trilha-etapa-numero">Etapa {indice + 1}</div>
                  <div className="trilha-etapa-duracao">
                    <span className="material-symbols-outlined">schedule</span>
                    {etapa.duracao_minutos} min
                  </div>
                </div>
                <h4>{etapa.titulo}</h4>
                <p>{etapa.objetivo}</p>
              </div>
            </div>
          );
        })}
      </div>

      {etapasCompletas.size === trilha.length && trilha.length > 0 && (
        <div className="trilha-estudo-parabens">
          <span className="material-symbols-outlined">celebration</span>
          <strong>Parabéns!</strong>
          <p>Você completou todas as etapas da trilha de estudo.</p>
        </div>
      )}
    </div>
  );
}
