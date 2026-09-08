import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/estados'

export type TomDelta = 'positivo' | 'negativo' | 'neutro'

/**
 * Cartao de KPI — CLAUDE.md §10.4.
 * Rotulo pequeno, valor em mono (e o valor que a pessoa veio ler) e um delta
 * semantico opcional. A faixa dourada a esquerda amarra o cartao a identidade
 * sem competir com o numero.
 */
export function CardKpi({
  rotulo,
  valor,
  delta,
  tom = 'neutro',
  carregando = false,
  destaque = false,
}: {
  rotulo: string
  valor: string
  // `| undefined` explicito: com exactOptionalPropertyTypes, passar um valor
  // calculado que pode ser undefined nao compila sem isso.
  delta?: string | undefined
  tom?: TomDelta | undefined
  carregando?: boolean | undefined
  destaque?: boolean | undefined
}) {
  if (carregando) {
    return (
      <div className="relative overflow-hidden rounded-card border border-line-soft bg-panel px-4.5 py-4.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3.5 h-7 w-32" />
        <Skeleton className="mt-2.5 h-3 w-20" />
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-card border border-line-soft bg-panel px-4.5 py-4.5">
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-0.5',
          destaque ? 'bg-gold' : 'bg-gold/50',
        )}
        aria-hidden
      />

      <p className="text-[11px] uppercase tracking-[0.6px] text-ink-3">{rotulo}</p>

      <p
        className={cn(
          'num mt-2.5 text-[25px] font-bold leading-none',
          destaque ? 'text-gold-bright' : 'text-ink',
        )}
      >
        {valor}
      </p>

      {delta !== undefined && (
        <p
          className={cn(
            'mt-1.75 text-[11.5px]',
            tom === 'positivo' && 'text-success-txt',
            tom === 'negativo' && 'text-danger-txt',
            tom === 'neutro' && 'text-ink-3',
          )}
        >
          {delta}
        </p>
      )}
    </div>
  )
}

/**
 * Grade dos KPIs: 4 colunas no desktop.
 *
 * Era 6, o que com 8 cartoes deixava a segunda fila pela metade. Com 4, os 8
 * cartoes formam duas filas cheias — e cada cartao ganha largura, entao rotulos
 * como "PRODUTOS MONITORADOS" param de quebrar em duas linhas.
 */
export function GradeKpi({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  )
}
