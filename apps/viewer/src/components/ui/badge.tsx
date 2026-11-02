import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-px font-sans text-xs font-medium',
  {
    variants: {
      tone: {
        ok: 'bg-ok-bg text-ok',
        warn: 'bg-warn-bg text-warn',
        bad: 'bg-bad-bg text-bad',
        mute: 'bg-sunken text-muted',
        live: 'bg-accent-bg text-accent',
      },
    },
    defaultVariants: { tone: 'mute' },
  },
)

export function Badge({
  className,
  tone,
  children,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {tone === 'live' && (
        <span className="bg-accent size-[7px] rounded-full motion-safe:animate-pulse" />
      )}
      {children}
    </span>
  )
}
