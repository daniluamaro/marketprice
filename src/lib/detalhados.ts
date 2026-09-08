import { supabase } from '@/lib/supabase'
import type { Filtros } from '@/store/filtros'

/**
 * Tela "Dados Detalhados" (§9) — a unica que le a view crua, e a unica com
 * paginacao no servidor.
 *
 * Por que aqui nao ha RPC: as outras telas mostram agregados, e agregado tem
 * que ser calculado no Postgres. Esta mostra a linha como ela e, com ordenacao
 * e pagina escolhidas pelo usuario — exatamente o que o PostgREST ja resolve
 * com `.range()` e `count: 'exact'`, sem uma funcao por combinacao de coluna.
 *
 * A RLS continua valendo: `v_precos_base` e `security_invoker`, entao a view
 * enxerga apenas o CNPJ do usuario logado.
 */

export interface LinhaDetalhe {
  cod_barras: number
  nome_exibicao: string | null
  nome_original: string | null
  ncm_grupo: string | null
  classe_item: string | null
  cnpj_estabelecimento: string | null
  nome_estabelecimento: string | null
  bairro: string | null
  cidade: string | null
  preco_liquido: string | null
  data_nf: string | null
}

const COLUNAS =
  'cod_barras,nome_exibicao,nome_original,ncm_grupo,classe_item,' +
  'cnpj_estabelecimento,nome_estabelecimento,bairro,cidade,preco_liquido,data_nf'

export type ColunaOrdenavel =
  | 'data_nf'
  | 'preco_liquido'
  | 'nome_exibicao'
  | 'nome_estabelecimento'
  | 'cidade'

export interface Ordenacao {
  coluna: ColunaOrdenavel
  asc: boolean
}

export interface PaginaDetalhes {
  linhas: LinhaDetalhe[]
  total: number
}

/**
 * As RPCs comparam a data ja convertida para America/Sao_Paulo. Aqui o filtro
 * vai como instante com offset -03:00 para dar exatamente o mesmo recorte —
 * sem isso, um relatorio mostraria um dia a mais que o outro.
 */
function aplicarFiltros<Q extends {
  eq: (c: string, v: unknown) => Q
  gte: (c: string, v: unknown) => Q
  lte: (c: string, v: unknown) => Q
}>(q: Q, f: Filtros): Q {
  let r = q
  if (f.ean !== null) r = r.eq('cod_barras', Number(f.ean))
  if (f.cidade !== null) r = r.eq('cidade', f.cidade)
  if (f.ncmGrupo !== null) r = r.eq('ncm_grupo', f.ncmGrupo)
  if (f.estabelecimento !== null) r = r.eq('cnpj_estabelecimento', f.estabelecimento)
  if (f.dataIni !== null) r = r.gte('data_nf', `${f.dataIni}T00:00:00-03:00`)
  if (f.dataFim !== null) r = r.lte('data_nf', `${f.dataFim}T23:59:59.999-03:00`)
  return r
}

export async function buscarDetalhes(
  f: Filtros,
  pagina: number,
  porPagina: number,
  ordem: Ordenacao,
): Promise<PaginaDetalhes> {
  const de = pagina * porPagina

  let q = supabase.from('v_precos_base').select(COLUNAS, { count: 'exact' })
  q = aplicarFiltros(q, f)

  const { data, error, count } = await q
    .order(ordem.coluna, { ascending: ordem.asc, nullsFirst: false })
    // Desempate estavel: sem uma segunda chave, duas linhas com a mesma data
    // podem trocar de lugar entre paginas e sumir da listagem.
    .order('cod_barras', { ascending: true })
    .order('cnpj_estabelecimento', { ascending: true })
    .range(de, de + porPagina - 1)

  if (error) throw new Error(error.message)
  return { linhas: (data ?? []) as unknown as LinhaDetalhe[], total: count ?? 0 }
}

/** Teto do export: protege a aba do navegador de um CSV que ela nao aguenta. */
export const MAX_EXPORT = 50_000
const LOTE = 1000

/**
 * Baixa o recorte inteiro em lotes para o CSV. O PostgREST limita o tamanho da
 * resposta, entao paginar aqui e obrigatorio — nao e otimizacao.
 */
export async function buscarTodosParaExport(
  f: Filtros,
  ordem: Ordenacao,
  aoProgredir?: (baixadas: number, total: number) => void,
): Promise<LinhaDetalhe[]> {
  const acumulado: LinhaDetalhe[] = []
  let pagina = 0

  for (;;) {
    const { linhas, total: t } = await buscarDetalhes(f, pagina, LOTE, ordem)
    acumulado.push(...linhas)
    aoProgredir?.(acumulado.length, Math.min(t, MAX_EXPORT))

    if (linhas.length < LOTE || acumulado.length >= Math.min(t, MAX_EXPORT)) break
    pagina += 1
  }

  return acumulado.slice(0, MAX_EXPORT)
}
