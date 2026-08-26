import { gravarLocalStorage } from "./use-local-storage";

/**
 * Perfis de acessibilidade. Porte de frontend/js/profile.js, com uma
 * diferença: aqui o aluno pode marcar mais de um.
 *
 * Surdez, baixa visão e dislexia não são categorias excludentes — a mesma
 * pessoa pode precisar de LIBRAS na câmera e de texto maior. O valor guardado
 * é a lista separada por espaço ("surdo baixa-visao"), que é exatamente o que
 * o seletor de atributo `~=` do CSS sabe casar:
 *
 *     body[data-perfil~="baixa-visao"] { ... }
 *
 * Um valor antigo, de uma escolha única ("surdo"), continua sendo lido como
 * uma lista de um item — não precisa de migração.
 */

export const CHAVE_PERFIL = "jovi_perfil";

/** "padrao" não é um perfil: é a ausência de adaptações. */
export type PerfilId = "surdo" | "baixa-visao" | "dislexia-tdah";

export const PERFIS: { id: PerfilId; nome: string; descricao: string; icone: string }[] = [
  {
    id: "surdo",
    nome: "Surdo ou com deficiência auditiva",
    descricao: "Abre a câmera em LIBRAS e prioriza legendas.",
    icone: "sign_language",
  },
  {
    id: "baixa-visao",
    nome: "Baixa visão",
    descricao: "Texto maior, mais contraste e narração automática.",
    icone: "visibility",
  },
  {
    id: "dislexia-tdah",
    nome: "Dislexia ou TDAH",
    descricao: "Abre os resumos no Modo Foco, em cartões curtos com leitura guiada.",
    icone: "center_focus_strong",
  },
];

const IDS = new Set<string>(PERFIS.map((p) => p.id));

/** Lista de perfis a partir do valor cru do localStorage. */
export function lerPerfis(valor: string | null | undefined): PerfilId[] {
  return (valor || "").split(/\s+/).filter((id): id is PerfilId => IDS.has(id));
}

/** Atalho para os consumidores, que leem a chave como string. */
export function temPerfil(valor: string | null | undefined, id: PerfilId): boolean {
  return lerPerfis(valor).includes(id);
}

export function gravarPerfis(perfis: PerfilId[]) {
  // Passa pelo gravarLocalStorage para que os componentes que leem o perfil
  // com useLocalStorage sejam notificados nesta mesma aba.
  gravarLocalStorage(CHAVE_PERFIL, perfis.join(" "));
  if (typeof document !== "undefined") document.body.dataset.perfil = perfis.join(" ");
}

/** Liga ou desliga um perfil, preservando os outros. */
export function alternarPerfil(atuais: PerfilId[], id: PerfilId): PerfilId[] {
  const novos = atuais.includes(id) ? atuais.filter((p) => p !== id) : [...atuais, id];
  gravarPerfis(novos);
  return novos;
}
