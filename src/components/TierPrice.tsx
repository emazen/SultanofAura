'use client'
import type { Product, Variant } from '@/payload-types'

import React from 'react'
import { cn } from '@/utilities/cn'
import { Price } from '@/components/Price'
import { resolvePrice, useIsWholesale } from '@/hooks/usePricing'

type Priced =
  | Pick<Product, 'priceInTRY' | 'wholesalePriceInTRY'>
  | Pick<Variant, 'priceInTRY' | 'wholesalePriceInTRY'>
  | null
  | undefined

type Props = {
  item: Priced
  /** Multiply by quantity (e.g. cart lines). */
  quantity?: number
  className?: string
  /** Compact: only the effective price, no retail comparison. */
  compact?: boolean
}

/**
 * Shows the price the current visitor pays. Approved wholesale customers see the
 * toptan price with the retail price struck through beside it; everyone else
 * simply sees the retail price.
 */
export const TierPrice: React.FC<Props> = ({ item, quantity = 1, className, compact }) => {
  const isWholesaleUser = useIsWholesale()
  const { amount, retail, isWholesale } = resolvePrice(item, isWholesaleUser)

  if (amount === null) return null

  if (!isWholesale || compact) {
    return <Price amount={amount * quantity} className={className} />
  }

  return (
    <span className={cn('inline-flex flex-col items-end leading-tight', className)}>
      <span className="inline-flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5">
          Toptan
        </span>
        <Price amount={amount * quantity} as="span" />
      </span>
      {retail !== null && (
        <Price
          amount={retail * quantity}
          as="span"
          className="text-xs text-primary/50 line-through"
        />
      )}
    </span>
  )
}
