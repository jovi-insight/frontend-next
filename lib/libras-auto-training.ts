export type StatusAtualizacaoAutomatica =
  | {
      status: "waiting-for-classes";
      ready_classes: string[];
      minimum_classes: number;
    }
  | {
      status: "queued";
      ready_classes: string[];
      job?: { job_id?: string };
    }
  | {
      status: "scheduled";
      active_job_id: string;
      ready_classes: string[];
    }
  | { status: "unchanged" };

export function descreverAtualizacaoAutomatica(status?: StatusAtualizacaoAutomatica): {
  titulo: string;
  detalhe: string;
} {
  switch (status?.status) {
    case "waiting-for-classes":
      return {
        titulo: "Amostras salvas",
        detalhe: "Cadastre mais uma letra; depois disso a rede será atualizada automaticamente.",
      };
    case "queued":
      return {
        titulo: "Rede atualizando em segundo plano",
        detalhe: "Pode cadastrar a próxima letra agora. O modelo ativo continua funcionando durante a atualização.",
      };
    case "scheduled":
      return {
        titulo: "Nova atualização agendada",
        detalhe: "Pode continuar coletando. As novas amostras entrarão automaticamente no próximo modelo.",
      };
    case "unchanged":
      return {
        titulo: "Nenhuma amostra nova",
        detalhe: "Essa rodada já estava salva; você pode repetir a letra ou escolher outra.",
      };
    default:
      return {
        titulo: "Atualização automática ativa",
        detalhe: "Salve uma letra e continue coletando; o INSIGHT atualiza a rede em segundo plano.",
      };
  }
}
