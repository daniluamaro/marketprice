import { cn } from '@/lib/utils'

/**
 * Barra inline em CSS — §10.4. Usada dentro de tabelas para dispersao e
 * ranking, onde um grafico completo seria exagero e um numero sozinho nao
 * comunica proporcao.
 *
 * `tom` e semantico: a mesma barra vermelha significa "preco fora de controle"
 * em qualquer tela do produto.
 */
export function BarraInline({
  proporcao,
  tom = 'marca',
  titulo,
}: {
  /** 0 a 1. Valores fora da faixa sao aparados. */
  proporcao: number
  tom?: 'ok' | 'alerta' | 'critico' | 'marca'
  titulo?: string
}) {
  const pct = Math.max(0, Math.min(1, proporcao)) * 100

  return (
    <div
      className="h-1.25 w-full overflow-hidden rounded-badge bg-elevated"
      role="img"
      aria-label={titulo ?? `${pct.toFixed(0)}%`}
      title={titulo}
    >
      <div
        className={cn(
          'h-full rounded-badge',
          tom === 'ok' && 'bg-success',
          tom === 'alerta' && 'bg-warning',
          tom === 'critico' && 'bg-danger',
          tom === 'marca' && 'bg-linear-to-r from-gold-dim to-gold-bright',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
