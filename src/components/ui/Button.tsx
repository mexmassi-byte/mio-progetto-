import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base-950 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-soft shadow-glow',
  secondary:
    'bg-base-700 text-zinc-100 hover:bg-base-600 border border-line',
  outline:
    'border border-line text-zinc-200 hover:bg-base-800 hover:border-base-600',
  ghost: 'text-zinc-300 hover:bg-base-800 hover:text-white',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
