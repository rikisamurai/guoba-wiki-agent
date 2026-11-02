import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default',
  {
    variants: {
      variant: {
        /** 文字链接样式，例如「展开全部」 */
        link: 'text-accent hover:underline',
        /** 整行可点的列表项 */
        row: 'w-full text-left hover:bg-bg',
      },
    },
    defaultVariants: { variant: 'link' },
  },
)

export function Button({
  className,
  variant,
  type = 'button',
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />
}
