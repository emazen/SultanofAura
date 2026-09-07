'use client'
import type { Product, Variant } from '@/payload-types'

import { useAuth } from '@/providers/Auth'
import { isWholesaleApproved } from '@/access/wholesale'

type Priced = Pick<Product, 'priceInTRY' | 'wholesalePriceInTRY'> | Pick<Variant, 'priceInTRY' | 'wholesalePriceInTRY'>

export type ResolvedPrice = {
  /** Price the current visitor will actually pay (kuruş). */
  amount: number | null
  /** Retail price, always available. */
  retail: number | null
  /** Wholesale price — only present when the API returned it (approved users). */
  wholesale: number | null
  /** Whether the amount shown is the wholesale tier. */
  isWholesale: boolean
}

export const resolvePrice = (item: Priced | null | undefined, wholesaleUser: boolean): ResolvedPrice => {
  const retail = typeof item?.priceInTRY === 'number' ? item.priceInTRY : null
  const wholesale = typeof item?.wholesalePriceInTRY === 'number' ? item.wholesalePriceInTRY : null
  const useWholesale = wholesaleUser && wholesale !== null
  return {
    amount: useWholesale ? wholesale : retail,
    retail,
    wholesale,
    isWholesale: useWholesale,
  }
}

/** Client hook: is the logged-in visitor an approved wholesale customer? */
export const useIsWholesale = (): boolean => {
  const { user } = useAuth()
  return isWholesaleApproved(user)
}

export const usePrice = (item: Priced | null | undefined): ResolvedPrice => {
  const wholesaleUser = useIsWholesale()
  return resolvePrice(item, wholesaleUser)
}
