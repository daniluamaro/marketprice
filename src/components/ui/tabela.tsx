import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Primitivos de tabela — CLAUDE.md §10.4.
 * Cabecalho discreto em caixa alta, linhas com hover, numeros a direita em
 * mono. Conteudo largo rola dentro do proprio container: a pagina nunca rola
 * na horizontal.
 */

export function Tabela({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-[12.5px]">{children}</table>
    </div>
  )
}

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numerica?: boolean
  ordenavel?: boolean
  direcao?: 'asc' | 'desc' | null
}

export function Th({
  children,
  className,
  numerica = false,
  ordenavel = false,
  direcao = null,
  ...props
}: ThProps) {
  return (
    <th
      scope="col"
      aria-sort={
        direcao === null ? undefined : direcao === 'asc' ? 'ascending' : 'descending'
      }
      className={cn(
        'border-b border-line px-3 pb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-ink-3',
        numerica ? 'text-right' : 'text-left',
        ordenavel && 'cursor-pointer select-none transition-colors hover:text-ink-2',
        direcao !== null && 'text-gold-bright',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1',
          numerica && 'flex-row-reverse',
        )}
      >
        {children}
        {direcao === 'asc' && <ArrowUp className="size-3" aria-hidden />}
        {direcao === 'desc' && <ArrowDown className="size-3" aria-hidden />}
      </span>
    </th>
  )
}

interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numerica?: boolean
  forte?: boolean
}

export function Td({
  children,
  className,
  numerica = false,
  forte = false,
  ...props
}: TdProps) {
  return (
    <td
      className={cn(
        'border-b border-line-soft px-3 py-3 align-middle',
        numerica ? 'num text-right text-ink-2' : 'text-ink-2',
        forte && 'font-semibold text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-hover/60">{children}</tr>
}
