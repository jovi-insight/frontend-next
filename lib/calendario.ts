import type { TipoEventoCalendario } from "./api";

export const TIPOS_EVENTO = [
  { valor: "prova", rotulo: "Prova", icone: "assignment" },
  { valor: "avaliacao", rotulo: "Avaliação", icone: "fact_check" },
  { valor: "trabalho", rotulo: "Trabalho", icone: "group" },
  { valor: "atividade", rotulo: "Atividade", icone: "task_alt" },
  { valor: "outro", rotulo: "Outro", icone: "event_note" },
] as const;

export const LEMBRETES_CALENDARIO = [
  { minutos: 0, rotulo: "Na hora" },
  { minutos: 60, rotulo: "1 hora antes" },
  { minutos: 1440, rotulo: "1 dia antes" },
  { minutos: 4320, rotulo: "3 dias antes" },
  { minutos: 10080, rotulo: "7 dias antes" },
] as const;

export function rotuloTipoEvento(tipo: TipoEventoCalendario): string {
  return TIPOS_EVENTO.find((item) => item.valor === tipo)?.rotulo ?? "Outro";
}

export function rotuloLembrete(minutos: number): string {
  return (
    LEMBRETES_CALENDARIO.find((item) => item.minutos === minutos)?.rotulo ??
    `${minutos} min antes`
  );
}
