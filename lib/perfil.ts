import { gravarLocalStorage } from "./use-local-storage";

/**
 * Perfil de acessibilidade. Porte de frontend/js/profile.js.
 *
 * O jovi.css reage a body[data-perfil="..."] — é assim que baixa visão ganha
 * texto maior e mais contraste sem nenhuma linha de JS extra.
 */

export const CHAVE_PERFIL = "jovi_perfil";
const PADRAO = "padrao";

export type PerfilId = "padrao" | "surdo" | "baixa-visao" | "dislexia-tdah";

export const PERFIS: { id: PerfilId; nome: string; descricao: string; icone: string }[] = [
  {
    id: "padrao",
    nome: "Padrão",
    descricao: "Interface completa, sem adaptações.",
    icone: "person",
  },
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

export function lerPerfil(): PerfilId {
  try {
    const salvo = localStorage.getItem(CHAVE_PERFIL);
    return PERFIS.some((p) => p.id === salvo) ? (salvo as PerfilId) : PADRAO;
  } catch {
    return PADRAO; // modo privado bloqueia o localStorage
  }
}

export function aplicarPerfil(id: PerfilId) {
  // Passa pelo gravarLocalStorage para que os componentes que leem o perfil
  // com useLocalStorage sejam notificados nesta mesma aba.
  gravarLocalStorage(CHAVE_PERFIL, id);
  if (typeof document !== "undefined") document.body.dataset.perfil = id;
}
