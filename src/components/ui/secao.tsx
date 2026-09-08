import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Cartao de secao — CLAUDE.md §10.4.
 *
 * Estrutura fixa: eyebrow (rotulo curto em acento) + titulo display + descricao
 * opcional, com espaco a direita para um indicador de contexto. Toda tela do
 * produto usa este componente, e e dele que vem a consistencia entre as telas.
 */
export function Secao({
  eyebrow,
  titulo,
  descricao,
  acessorio,
  children,
  className,
}: {
  eyebrow: string
  titulo: string
  descricao?: string
  acessorio?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-panel border border-line-soft bg-panel px-6 py-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[1.3px] text-gold">
            {eyebrow}
          </p>
          <h2 className="mt-1 font-display text-[17px] font-extrabold tracking-[-0.2px] text-ink">
            {titulo}
          </h2>
        </div>
        {acessorio !== undefined && <div className="shrink-0">{acessorio}</div>}
      </div>

      {/*
        A descricao fica FORA da linha do acessorio, de proposito. Dentro dela,
        um `max-w` percentual media a coluna de texto — que encolhe conforme o
        selo da direita cresce — e o mesmo 80% rendia larguras diferentes de
        bloco para bloco. Aqui os 80% valem sobre a secao inteira, sempre.
      */}
      {descricao !== undefined && (
        <p className="mt-1.5 max-w-[80%] text-[12.5px] leading-relaxed text-ink-2">
          {descricao}
        </p>
      )}

      {children !== undefined && <div className="mt-5">{children}</div>}
    </section>
  )
}

/** Indicador discreto de contexto, no canto da secao (ex.: "23 produtos · 90 lojas"). */
export function TagSecao({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-chip border border-line bg-elevated px-2.5 py-1.5 text-[10.5px] text-ink-2">
      {children}
    </span>
  )
}
