import { useQuery } from '@tanstack/react-query'
import { buscarOpcoesFiltro, type OpcoesFiltro } from '@/lib/rpc'

/**
 * Catalogo de opcoes do tenant (produtos, lojas, cidades, categorias).
 *
 * Uma unica queryKey para o app inteiro: a barra de filtros, o seletor de
 * produto e os titulos das telas leem a MESMA entrada de cache, entao a RPC
 * roda uma vez por sessao e nao uma vez por componente.
 */
export function useCatalogo() {
  return useQuery<OpcoesFiltro>({
    queryKey: ['opcoes-filtro'],
    queryFn: buscarOpcoesFiltro,
    staleTime: 5 * 60_000,
  })
}

/** Nome de exibicao de um EAN, para titulos e legendas. */
export function useNomeProduto(ean: string | null): string | null {
  const { data } = useCatalogo()
  if (ean === null) return null
  return data?.produtos.find((p) => p.ean === ean)?.nome ?? null
}

/** Nome de exibicao de um CNPJ de estabelecimento. */
export function useNomeEstabelecimento(cnpj: string | null): string | null {
  const { data } = useCatalogo()
  if (cnpj === null) return null
  return data?.estabelecimentos.find((e) => e.cnpj === cnpj)?.nome ?? null
}
