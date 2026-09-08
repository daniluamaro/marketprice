import { useMemo, useState } from 'react'
import { Package, Search } from 'lucide-react'
import { useCatalogo } from '@/lib/catalogo'
import { useFiltros } from '@/store/filtros'
import { Skeleton } from '@/components/ui/estados'
import { cn } from '@/lib/utils'

/**
 * As telas "Comparativo" e "Evolucao" analisam UM produto — sem EAN escolhido
 * elas nao tem o que desenhar. Em vez de um vazio dizendo "escolha um produto
 * no filtro la em cima", a escolha acontece aqui mesmo (§10.7: o estado vazio
 * orienta e, quando possivel, resolve).
 *
 * Escreve no MESMO filtro global da barra superior, entao a escolha sobrevive a
 * troca de relatorio — que e o comportamento esperado de um filtro global.
 */
export function SeletorProduto({
  titulo = 'Escolha um produto para analisar',
  descricao = 'A comparação é sempre por código de barras. Busque pelo nome ou digite o EAN.',
}: {
  titulo?: string
  descricao?: string
}) {
  const definir = useFiltros((s) => s.definir)
  const [busca, setBusca] = useState('')

  // Mesmo cache da barra de filtros: reaproveita a entrada, nao refaz a RPC.
  const opcoes = useCatalogo()

  const produtos = useMemo(() => {
    const todos = opcoes.data?.produtos ?? []
    const termo = busca.trim().toLowerCase()
    if (termo === '') return todos
    return todos.filter((p) =>
      `${p.nome ?? ''} ${p.ean}`.toLowerCase().includes(termo),
    )
  }, [opcoes.data, busca])

  return (
    <div className="rounded-panel border border-dashed border-line bg-panel px-6 py-7">
      <div className="flex flex-col items-center text-center">
        <div className="rounded-full border border-line bg-elevated p-3">
          <Package className="size-5 text-gold" aria-hidden />
        </div>
        <p className="mt-3.5 font-display text-[15.5px] font-bold text-ink">{titulo}</p>
        <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-ink-2">
          {descricao}
        </p>
      </div>

      <div className="mx-auto mt-5 max-w-140">
        <div className="flex items-center gap-2 rounded-card border border-line bg-elevated px-3.5 py-2.5 focus-within:border-gold/45">
          <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou EAN..."
            aria-label="Buscar produto"
            className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
        </div>

        {opcoes.isPending && (
          <div className="mt-3 flex flex-col gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        )}

        {opcoes.isSuccess && (
          <ul className="mt-3 max-h-80 overflow-y-auto rounded-card border border-line-soft">
            {produtos.map((p, i) => (
              <li key={p.ean}>
                <button
                  type="button"
                  onClick={() => definir('ean', p.ean)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-hover',
                    i > 0 && 'border-t border-line-soft',
                  )}
                >
                  <span className="min-w-0 truncate text-[12.5px] text-ink">
                    {p.nome ?? 'Produto sem nome'}
                  </span>
                  <span className="num shrink-0 text-[11px] text-ink-3">{p.ean}</span>
                </button>
              </li>
            ))}

            {produtos.length === 0 && (
              <li className="px-3.5 py-5 text-center text-[12.5px] text-ink-3">
                Nenhum produto encontrado para “{busca}”.
              </li>
            )}
          </ul>
        )}

        {opcoes.isError && (
          <p className="mt-3 text-center text-[12.5px] text-danger-txt">
            Não foi possível carregar a lista de produtos.
          </p>
        )}
      </div>
    </div>
  )
}
