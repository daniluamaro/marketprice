import { create } from 'zustand'

/**
 * Filtros globais (CLAUDE.md §9). Vivem fora do roteador porque atravessam
 * todas as telas: trocar de relatorio nao deve perder o recorte escolhido.
 *
 * `null` sempre significa "sem filtro". Nunca use string vazia — ela viraria
 * um filtro por texto vazio nas RPCs.
 */
export interface Filtros {
  dataIni: string | null
  dataFim: string | null
  cidade: string | null
  ncmGrupo: string | null
  ean: string | null
  estabelecimento: string | null
}

const VAZIO: Filtros = {
  dataIni: null,
  dataFim: null,
  cidade: null,
  ncmGrupo: null,
  ean: null,
  estabelecimento: null,
}

interface FiltrosStore extends Filtros {
  definir: <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => void
  definirPeriodo: (ini: string | null, fim: string | null) => void
  limpar: () => void
}

export const useFiltros = create<FiltrosStore>((set) => ({
  ...VAZIO,
  definir: (campo, valor) => set({ [campo]: valor } as Pick<Filtros, typeof campo>),
  definirPeriodo: (ini, fim) => set({ dataIni: ini, dataFim: fim }),
  limpar: () => set({ ...VAZIO }),
}))

/** Quantos filtros estao ativos — usado para mostrar o botao "limpar". */
export function contarAtivos(f: Filtros): number {
  return [f.dataIni ?? f.dataFim, f.cidade, f.ncmGrupo, f.ean, f.estabelecimento].filter(
    (v) => v !== null,
  ).length
}

/**
 * Converte para os parametros das RPCs. As chaves batem com os nomes dos
 * argumentos no Postgres; o supabase-js envia como named params.
 */
export function paraArgsRpc(f: Filtros): Record<string, string | null> {
  return {
    p_data_ini: f.dataIni,
    p_data_fim: f.dataFim,
    p_ncm_grupo: f.ncmGrupo,
    p_cidade: f.cidade,
    p_ean: f.ean,
    p_estab: f.estabelecimento,
  }
}

/** Chave estavel para o cache do TanStack Query. */
export function chaveCache(f: Filtros): string {
  return [f.dataIni, f.dataFim, f.cidade, f.ncmGrupo, f.ean, f.estabelecimento].join('|')
}
