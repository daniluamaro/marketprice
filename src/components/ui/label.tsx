import * as React from 'react'
import { cn } from '@/lib/utils'

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'block text-[10.5px] font-medium uppercase tracking-[1.1px] text-ink-3',
        className,
      )}
      {...props}
    />
  ),
)
Label.displayName = 'Label'
