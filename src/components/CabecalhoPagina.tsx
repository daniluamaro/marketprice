import type { ReactNode } from 'react'
import { BarraFiltros } from '@/components/filtros/BarraFiltros'

/**
 * Topo de cada relatorio: titulo grande em display, uma linha de contexto e a
 * barra de filtros globais logo abaixo.
 *
 * A linha de contexto usa "·" como separador porque cada pedaco e um fato
 * independente sobre o recorte (onde, quando, quanto) — nao e uma frase.
 */
export function CabecalhoPagina({
  titulo,
  contexto,
  selo,
  comFiltros = true,
}: {
  titulo: string
  contexto?: (string | null | undefined)[]
  selo?: ReactNode
  comFiltros?: boolean
}) {
  const partes = (contexto ?? []).filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  )

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.4px] text-ink">
            {titulo}
          </h1>
          {partes.length > 0 && (
            <p className="mt-1.5 text-[13px] text-ink-2">{partes.join(' · ')}</p>
          )}
        </div>
        {selo !== undefined && <div className="shrink-0">{selo}</div>}
      </div>

      {comFiltros && (
        <div className="mt-5">
          <BarraFiltros />
        </div>
      )}
    </header>
  )
}

/** Selo de contexto do topo (ex.: "Amostra piloto · 4 dias de dados"). */
export function SeloTopo({
  children,
  tom = 'alerta',
}: {
  children: ReactNode
  tom?: 'alerta' | 'marca'
}) {
  return (
    <span
      className={
        tom === 'alerta'
          ? 'inline-flex items-center gap-2 rounded-full border border-warning/35 bg-warning/9 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-warning-txt'
          : 'inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/9 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-gold-bright'
      }
    >
      {children}
    </span>
  )
}
