import { cn } from '@/lib/utils'

/**
 * Marca do produto: selo em gradiente dourado com o "P" de Price + wordmark
 * "MARKET PRICE" em display.
 */
export function Marca({
  compacta = false,
  tamanho = 'padrao',
  className,
}: {
  compacta?: boolean
  /** "grande" e usada como assinatura no topo da tela de login. */
  tamanho?: 'padrao' | 'grande'
  className?: string
}) {
  const grande = tamanho === 'grande'

  return (
    <div className={cn('flex items-center', grande ? 'gap-3.5' : 'gap-2.5', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-chip font-display font-extrabold text-[#0A0D14]',
          grande ? 'size-13 text-[24px]' : 'size-8.5 text-[15px]',
        )}
        style={{ background: 'linear-gradient(135deg, #F0CC5C, #8A7328)' }}
        aria-hidden
      >
        P
      </div>
      {!compacta && (
        <span
          className={cn(
            'font-display font-extrabold text-ink',
            grande
              ? 'text-[23px] tracking-[1.2px]'
              : 'text-[15px] tracking-[0.5px]',
          )}
        >
          MARKET PRICE
        </span>
      )}
    </div>
  )
}
