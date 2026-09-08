import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TomEtiqueta = 'ok' | 'alerta' | 'critico' | 'neutro' | 'marca'

/**
 * Etiqueta semantica — a cor carrega significado, nunca decoracao.
 * ok = dentro do esperado · alerta = observar · critico = agir · marca = destaque.
 */
export function Etiqueta({
  children,
  tom = 'neutro',
}: {
  children: ReactNode
  tom?: TomEtiqueta
}) {
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap rounded-badge border px-2 py-0.5 text-[10px] font-bold tracking-[0.3px]',
        tom === 'ok' && 'border-success/28 bg-success/10 text-success-txt',
        tom === 'alerta' && 'border-warning/28 bg-warning/10 text-warning-txt',
        tom === 'critico' && 'border-danger/30 bg-danger/12 text-danger-txt',
        tom === 'neutro' && 'border-line bg-elevated text-ink-2',
        tom === 'marca' && 'border-gold/28 bg-gold/10 text-gold-bright',
      )}
    >
      {children}
    </span>
  )
}
