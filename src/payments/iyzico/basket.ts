import type { CartLine } from '@/lib/cartPricing'

import { formatPrice } from './api'

export type IyzicoBasketItem = {
  category1: string
  id: string
  itemType: 'PHYSICAL'
  name: string
  price: string
}

/**
 * iyzico rejects a basket whose item prices do not add up to `price`, and the amount
 * we must charge is `cart.subtotal` — which the Carts hook may have recomputed at
 * wholesale prices. So build the lines from the resolved per-line prices, then push
 * any rounding difference onto the largest line so the two always agree exactly.
 */
export const buildBasketItems = ({
  lines,
  subtotal,
}: {
  lines: CartLine[]
  subtotal: number
}): IyzicoBasketItem[] => {
  const priced = lines.filter((line) => line.lineAmount > 0)

  if (!priced.length) {
    return [
      {
        category1: 'Genel',
        id: 'cart',
        itemType: 'PHYSICAL',
        name: 'Sepet',
        price: formatPrice(subtotal),
      },
    ]
  }

  const amounts = priced.map((line) => line.lineAmount)
  const difference = subtotal - amounts.reduce((total, amount) => total + amount, 0)

  if (difference !== 0) {
    let largest = 0
    amounts.forEach((amount, index) => {
      if (amount > amounts[largest]!) largest = index
    })
    amounts[largest] = amounts[largest]! + difference
  }

  return priced.map((line, index) => ({
    category1: 'Genel',
    id: String(line.variantID ?? line.productID),
    itemType: 'PHYSICAL' as const,
    name: line.title.slice(0, 100),
    price: formatPrice(amounts[index]!),
  }))
}
