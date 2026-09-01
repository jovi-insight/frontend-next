import type { TipoEventoCalendario } from "./api";

export const TIPOS_EVENTO = [
  { valor: "prova", rotulo: "Prova", icone: "assignment" },
  { valor: "avaliacao", rotulo: "Avaliação", icone: "fact_check" },
  { valor: "trabalho", rotulo: "Trabalho", icone: "group" },
  { valor: "atividade", rotulo: "Atividade", icone: "task_alt" },
  { valor: "outro", rotulo: "Outro", icone: "event_note" },
] as const;

export function rotuloTipoEvento(tipo: TipoEventoCalendario): string {
  return TIPOS_EVENTO.find((item) => item.valor === tipo)?.rotulo ?? "Outro";
}
