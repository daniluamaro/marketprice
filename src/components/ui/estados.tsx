import type { CSSProperties } from 'react'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

/** Skeleton — nunca spinner solto no meio da tela (§10.7). */
export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={cn('animate-pulse rounded-card bg-hover/70', className)}
      style={style}
      aria-hidden
    />
  )
}

export function EstadoVazio({
  titulo = 'Sem dados para exibir',
  descricao = 'Não há registros para o período, a categoria ou a cidade selecionados.',
}: {
  titulo?: string | undefined
  descricao?: string | undefined
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="rounded-full border border-line bg-elevated p-3">
        <Inbox className="size-5 text-ink-3" aria-hidden />
      </div>
      <p className="font-display text-[15px] font-bold text-ink">{titulo}</p>
      <p className="max-w-sm text-[12.5px] leading-relaxed text-ink-2">{descricao}</p>
    </div>
  )
}

export function EstadoErro({
  titulo = 'Não foi possível carregar',
  descricao = 'Houve uma falha ao buscar os dados. Tente novamente em instantes.',
  onTentarNovamente,
}: {
  titulo?: string | undefined
  descricao?: string | undefined
  onTentarNovamente?: (() => void) | undefined
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="rounded-full border border-danger/30 bg-danger/10 p-3">
        <AlertTriangle className="size-5 text-danger-txt" aria-hidden />
      </div>
      <p className="font-display text-[15px] font-bold text-ink">{titulo}</p>
      <p className="max-w-sm text-[12.5px] leading-relaxed text-ink-2">{descricao}</p>
      {onTentarNovamente && (
        <Button variant="outline" size="sm" onClick={onTentarNovamente} className="mt-1">
          <RefreshCw className="size-3.5" aria-hidden />
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
