import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const botao = cva(
  'inline-flex items-center justify-center gap-2 rounded-card font-medium ' +
    'transition-colors duration-150 select-none whitespace-nowrap ' +
    'disabled:pointer-events-none',
  {
    variants: {
      variant: {
        // O desabilitado do primario NAO usa opacity: dourado a 50% sobre fundo
        // escuro vira um marrom-oliva sujo. Ele troca para uma superficie
        // neutra, que le como "indisponivel" em vez de "cor errada".
        primary:
          'bg-gold text-[#0A0D14] font-semibold hover:bg-gold-bright ' +
          'disabled:bg-elevated disabled:text-ink-3 disabled:font-medium',
        outline:
          'border border-line bg-elevated text-ink hover:bg-hover hover:border-gold/40 ' +
          'disabled:opacity-50',
        ghost: 'text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-50',
        danger:
          'border border-danger/30 bg-danger/10 text-danger-txt hover:bg-danger/20 ' +
          'disabled:opacity-50',
      },
      size: {
        sm: 'h-8 px-3 text-[12.5px]',
        md: 'h-10 px-4 text-[13.5px]',
        lg: 'h-11 px-5 text-[14px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof botao> {
  carregando?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, carregando, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(botao({ variant, size }), className)}
      disabled={disabled === true || carregando === true}
      {...props}
    >
      {carregando === true && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
