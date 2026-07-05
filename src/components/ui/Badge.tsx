import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'accent' | 'cyan' | 'green' | 'amber' | 'purple'

const tones: Record<Tone, string> = {
  neutral: 'bg-base-700 text-zinc-300 border-line',
  accent: 'bg-accent/15 text-accent-soft border-accent/30',
  cyan: 'bg-signal/15 text-signal border-signal/30',
  green: 'bg-signal-green/15 text-signal-green border-signal-green/30',
  amber: 'bg-signal-amber/15 text-signal-amber border-signal-amber/30',
  purple: 'bg-signal-purple/15 text-signal-purple border-signal-purple/30',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
