import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-card border border-line bg-elevated px-3.5',
        'text-[14px] text-ink placeholder:text-ink-3',
        'transition-colors duration-150',
        'hover:border-line focus:border-gold/50 focus:outline-none',
        'focus-visible:outline-2 focus-visible:outline-gold-bright focus-visible:outline-offset-2',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
