import { supabase } from '@/lib/supabase'
import { paraArgsRpc, type Filtros } from '@/store/filtros'

/**
 * Tipos de retorno das RPCs analiticas.
 *
 * `numeric` do Postgres chega como STRING no JSON — por isso os campos de
 * dinheiro sao `string | null` e devem passar pelos formatadores de
 * `lib/format`, nunca por aritmetica direta no cliente.
 */

export interface Kpis {
  total_produtos: number
  total_estabelecimentos: number
  total_cidades: number
  preco_medio: string | null
  ultima_coleta: string | null
  variacao_recente_pct: string | null
  amplitude_media_pct: string | null
  total_bairros: number
  /** Cupons fiscais distintos que alimentaram o recorte — medida de amostra. */
  total_nfce: number
  preco_mediano: string | null
}

/** Uma barra do histograma de precos. */
export interface FaixaPreco {
  faixa: number
  preco_de: string | null
  preco_ate: string | null
  registros: number
  produtos: number
}

export interface LinhaDispersao {
  cod_barras: string
  nome_exibicao: string | null
  ncm_grupo: string | null
  estabelecimentos: number
  preco_min: string | null
  preco_medio: string | null
  preco_max: string | null
  amplitude_pct: string | null
}

export interface LinhaRanking {
  cnpj_estabelecimento: string
  nome_estabelecimento: string | null
  bairro: string | null
  cidade: string | null
  produtos_comparados: number
  preco_medio_loja: string | null
  preco_medio_mercado: string | null
  indice_competitividade: string | null
}

/**
 * Uma celula do Indice de Posicionamento de Preco: o cruzamento de um EAN com
 * um CNPJ de estabelecimento.
 */
export interface LinhaIpp {
  cod_barras: number
  nome_exibicao: string | null
  ncm_grupo: string | null
  cnpj_estabelecimento: string
  nome_estabelecimento: string | null
  bairro: string | null
  cidade: string | null
  preco: string | null
  preco_medio_mercado: string | null
  lojas_no_mercado: number
  ipp: string | null
  data_nf: string | null
}

/**
 * Uma loja no ranking por QUANTIDADE de itens abaixo da media de mercado —
 * a leitura de amplitude, complementar ao indice de competitividade (que mede
 * intensidade).
 */
export interface LinhaAbaixoMercado {
  cnpj_estabelecimento: string
  nome_estabelecimento: string | null
  bairro: string | null
  cidade: string | null
  itens_comparados: number
  itens_abaixo: number
  itens_acima: number
  pct_abaixo: string | null
  ipp_medio: string | null
  /** Diferenca media em R$ nos itens em que a loja fica abaixo. */
  economia_media: string | null
}

/**
 * Uma caixa do boxplot: a distribuicao dos precos de UM produto entre as lojas.
 *
 * `minimo`/`maximo` sao os extremos reais; `whisker_inf`/`whisker_sup` sao os
 * extremos DENTRO das cercas de Tukey — e o que a caixa desenha. Os dois
 * coincidem quando nao ha outlier, e e proposital que sejam campos separados.
 */
export interface CaixaPreco {
  cod_barras: number
  nome_exibicao: string | null
  ncm_grupo: string | null
  lojas: number
  minimo: string | null
  q1: string | null
  mediana: string | null
  q3: string | null
  maximo: string | null
  whisker_inf: string | null
  whisker_sup: string | null
  /** numeric[] do Postgres chega como array de numeros, nao de strings. */
  outliers: number[]
  preco_medio: string | null
  amplitude_pct: string | null
}

/** Quadrante da matriz preco x dispersao. A classificacao vem do servidor. */
export type Quadrante = 'oportunidade' | 'caro_estavel' | 'competitivo' | 'consolidado'

export interface PontoMatriz {
  cod_barras: number
  nome_exibicao: string | null
  ncm_grupo: string | null
  lojas: number
  preco_medio: string | null
  preco_min: string | null
  preco_max: string | null
  /** Coeficiente de variacao (%): desvio padrao sobre a media. */
  dispersao_pct: string | null
  amplitude_pct: string | null
  /** Medianas do recorte — as linhas que dividem os quadrantes. */
  corte_preco: string | null
  corte_dispersao: string | null
  quadrante: Quadrante
}

/** Frequencia de aparicao em NFC-e — proxy de giro (§ ver migration). */
export interface LinhaFrequencia {
  cod_barras: number
  nome_exibicao: string | null
  ncm_grupo: string | null
  nfce: number
  registros: number
  estabelecimentos: number
  cidades: number
  bairros: number
  /** Fatia do produto no total de aparicoes: soma 100% entre os produtos. */
  share_pct: string | null
  /** Em quantos % dos cupons do recorte o item aparece. Nao soma 100%. */
  penetracao_pct: string | null
  preco_medio: string | null
  primeira_nf: string | null
  ultima_nf: string | null
}

export type DimensaoFrequencia = 'estabelecimento' | 'cidade' | 'bairro'

export interface LinhaFrequenciaDimensao {
  cod_barras: number
  nome_exibicao: string | null
  /** Chave de agrupamento (CNPJ, cidade, ou "cidade · bairro"). */
  chave_id: string
  /** Rotulo de exibicao da dimensao. */
  chave: string
  /** Localizacao de apoio: cidade do bairro, bairro/cidade da loja. */
  contexto: string | null
  nfce: number
  registros: number
  share_produto_pct: string | null
  share_local_pct: string | null
  preco_medio: string | null
}

export interface LinhaCategoria {
  ncm_grupo: string
  produtos: number
  estabelecimentos: number
  preco_min: string | null
  preco_medio: string | null
  preco_max: string | null
  amplitude_mediana_pct: string | null
}

export interface LinhaGeografica {
  cidade: string
  bairro: string
  estabelecimentos: number
  produtos: number
  preco_min: string | null
  preco_medio: string | null
  preco_max: string | null
}

export interface LinhaIndiceGeo {
  cidade: string
  bairro: string
  estabelecimentos: number
  produtos: number
  preco_medio: string | null
  indice_competitividade: string | null
}

export interface LinhaComparativo {
  cnpj_estabelecimento: string
  nome_estabelecimento: string | null
  bairro: string | null
  cidade: string | null
  preco: string | null
  data_nf: string | null
  preco_min: string | null
  preco_medio: string | null
  preco_max: string | null
  spread_pct: string | null
  desvio_media_pct: string | null
}

/**
 * Serie diaria de UM produto. A RPC devolve uma serie extra com
 * `cnpj_estabelecimento = null` e nome "Média de mercado" — e a linha de
 * referencia, ja calculada no servidor.
 */
export interface PontoEvolucaoProduto {
  dia: string
  cnpj_estabelecimento: string | null
  nome_estabelecimento: string | null
  preco_medio: string | null
  preco_min: string | null
  preco_max: string | null
  registros: number
}

export interface PontoEvolucao {
  dia: string
  preco_medio: string | null
  preco_min: string | null
  preco_max: string | null
  produtos: number
  estabelecimentos: number
  registros: number
}

export interface OpcoesFiltro {
  data_min: string | null
  data_max: string | null
  cidades: string[]
  ncm_grupos: string[]
  produtos: { ean: string; nome: string | null }[]
  estabelecimentos: {
    cnpj: string
    nome: string | null
    bairro: string | null
    cidade: string | null
  }[]
}

async function chamarRpc<T>(nome: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args)
  if (error) throw new Error(error.message)
  return data as T
}

export function buscarOpcoesFiltro(): Promise<OpcoesFiltro> {
  return chamarRpc<OpcoesFiltro>('rpc_opcoes_filtro')
}

/** rpc_kpis devolve exatamente uma linha; a RLS pode torna-la vazia. */
export async function buscarKpis(f: Filtros): Promise<Kpis | null> {
  const linhas = await chamarRpc<Kpis[]>('rpc_kpis', paraArgsRpc(f))
  return linhas[0] ?? null
}

export function buscarDispersao(f: Filtros, limite = 10): Promise<LinhaDispersao[]> {
  return chamarRpc<LinhaDispersao[]>('rpc_dispersao_precos', {
    ...paraArgsRpc(f),
    p_limit: limite,
  })
}

/** Histograma dos precos vigentes, em faixas de largura igual. */
export function buscarDistribuicao(f: Filtros, faixas = 12): Promise<FaixaPreco[]> {
  return chamarRpc<FaixaPreco[]>('rpc_distribuicao_precos', {
    ...paraArgsRpc(f),
    p_faixas: faixas,
  })
}

export function buscarRanking(
  f: Filtros,
  opcoes: { minProdutos?: number; limite?: number } = {},
): Promise<LinhaRanking[]> {
  return chamarRpc<LinhaRanking[]>('rpc_ranking_estabelecimentos', {
    ...paraArgsRpc(f),
    p_min_produtos: opcoes.minProdutos ?? 3,
    p_limit: opcoes.limite ?? 100,
  })
}

/**
 * IPP por par (produto, loja).
 *
 * `minLojas` = 2 por padrao: com uma loja so vendendo o item, a "media de
 * mercado" e o proprio preco dela e o indice sai 100 por construcao.
 */
export function buscarIpp(
  f: Filtros,
  opcoes: { minLojas?: number; limite?: number } = {},
): Promise<LinhaIpp[]> {
  return chamarRpc<LinhaIpp[]>('rpc_ipp', {
    ...paraArgsRpc(f),
    p_min_lojas: opcoes.minLojas ?? 2,
    p_limit: opcoes.limite ?? 3000,
  })
}

/** Lojas ordenadas pela quantidade de itens em que batem a media de mercado. */
export function buscarAbaixoMercado(
  f: Filtros,
  opcoes: { minLojas?: number; limite?: number } = {},
): Promise<LinhaAbaixoMercado[]> {
  return chamarRpc<LinhaAbaixoMercado[]>('rpc_ranking_abaixo_mercado', {
    ...paraArgsRpc(f),
    p_min_lojas: opcoes.minLojas ?? 2,
    p_limit: opcoes.limite ?? 200,
  })
}

export function buscarCategorias(f: Filtros): Promise<LinhaCategoria[]> {
  const args = paraArgsRpc(f)
  // rpc_preco_categoria agrega POR categoria — passar p_ncm_grupo deixaria
  // o grafico com uma barra so, o que nao e uma analise por categoria.
  return chamarRpc<LinhaCategoria[]>('rpc_preco_categoria', {
    p_data_ini: args.p_data_ini,
    p_data_fim: args.p_data_fim,
    p_cidade: args.p_cidade,
    p_ean: args.p_ean,
    p_estab: args.p_estab,
  })
}

export function buscarGeografico(f: Filtros): Promise<LinhaGeografica[]> {
  return chamarRpc<LinhaGeografica[]>('rpc_preco_geografico', paraArgsRpc(f))
}

export function buscarEvolucaoMercado(f: Filtros): Promise<PontoEvolucao[]> {
  return chamarRpc<PontoEvolucao[]>('rpc_evolucao_mercado', paraArgsRpc(f))
}

/**
 * Comparativo de um produto entre lojas.
 *
 * Nao recebe `p_estab` de proposito: a tela existe para mostrar TODAS as lojas
 * que vendem aquele item. Filtrar por uma loja deixaria uma barra sozinha, que
 * nao e uma comparacao. Categoria tambem nao entra — com um EAN fixo ela e
 * sempre redundante.
 */
export function buscarComparativo(f: Filtros): Promise<LinhaComparativo[]> {
  if (f.ean === null) return Promise.resolve([])
  return chamarRpc<LinhaComparativo[]>('rpc_comparativo_produto', {
    p_ean: f.ean,
    p_data_ini: f.dataIni,
    p_data_fim: f.dataFim,
    p_cidade: f.cidade,
  })
}

/** Serie temporal de um produto, opcionalmente restrita a uma loja. */
export function buscarEvolucaoProduto(f: Filtros): Promise<PontoEvolucaoProduto[]> {
  if (f.ean === null) return Promise.resolve([])
  return chamarRpc<PontoEvolucaoProduto[]>('rpc_evolucao_preco', {
    p_ean: f.ean,
    p_estab: f.estabelecimento,
    p_data_ini: f.dataIni,
    p_data_fim: f.dataFim,
  })
}

/**
 * Boxplot e matriz: os dois graficos de DISPERSAO ENTRE LOJAS.
 *
 * Ambos ignoram `ean` e `estabelecimento` de proposito. Nao e descuido: um
 * filtro de loja deixa um preco por produto (dispersao zero, boxplot virando um
 * traco) e o filtro de EAN reduz a matriz a um ponto solitario, que nao e um
 * mapa. O EAN selecionado nao some — ele vai em `p_ean_destaque`, que ORDENA
 * (garantindo que o produto escolhido esteja no grafico) e permite a interface
 * pinta-lo em destaque no meio dos outros. E o mesmo criterio de
 * `buscarComparativo`, que ignora `p_estab` para nao virar uma barra so.
 */
export function buscarBoxplot(
  f: Filtros,
  opcoes: { minLojas?: number; limite?: number } = {},
): Promise<CaixaPreco[]> {
  return chamarRpc<CaixaPreco[]>('rpc_boxplot_precos', {
    p_data_ini: f.dataIni,
    p_data_fim: f.dataFim,
    p_ncm_grupo: f.ncmGrupo,
    p_cidade: f.cidade,
    p_ean_destaque: f.ean,
    p_min_lojas: opcoes.minLojas ?? 2,
    p_limit: opcoes.limite ?? 12,
  })
}

export function buscarMatrizDispersao(
  f: Filtros,
  opcoes: { minLojas?: number; limite?: number } = {},
): Promise<PontoMatriz[]> {
  return chamarRpc<PontoMatriz[]>('rpc_matriz_preco_dispersao', {
    p_data_ini: f.dataIni,
    p_data_fim: f.dataFim,
    p_ncm_grupo: f.ncmGrupo,
    p_cidade: f.cidade,
    p_min_lojas: opcoes.minLojas ?? 2,
    p_limit: opcoes.limite ?? 300,
  })
}

/** Giro por produto: cupons distintos em que cada EAN apareceu no periodo. */
export function buscarFrequenciaProduto(
  f: Filtros,
  limite = 200,
): Promise<LinhaFrequencia[]> {
  return chamarRpc<LinhaFrequencia[]>('rpc_frequencia_produto', {
    ...paraArgsRpc(f),
    p_limit: limite,
  })
}

/** O mesmo giro, quebrado por estabelecimento, cidade ou bairro. */
export function buscarFrequenciaDimensao(
  f: Filtros,
  dimensao: DimensaoFrequencia,
  limite = 300,
): Promise<LinhaFrequenciaDimensao[]> {
  return chamarRpc<LinhaFrequenciaDimensao[]>('rpc_frequencia_dimensao', {
    ...paraArgsRpc(f),
    p_dimensao: dimensao,
    p_limit: limite,
  })
}

export function buscarIndiceGeografico(
  f: Filtros,
  minProdutos = 2,
): Promise<LinhaIndiceGeo[]> {
  return chamarRpc<LinhaIndiceGeo[]>('rpc_indice_geografico', {
    ...paraArgsRpc(f),
    p_min_produtos: minProdutos,
  })
}
