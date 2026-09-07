import type { PayloadRequest } from 'payload'

import type { Cart } from '@/payload-types'

import { PRICE_FIELD, WHOLESALE_PRICE_FIELD } from '@/lib/currency'

export type CartItem = NonNullable<Cart['items']>[number]

export type CartLine = {
  /** Amount for the whole line (unit x quantity), in kuruş. */
  lineAmount: number
  productID: number | string
  quantity: number
  /** Human readable label, used for the iyzico basket and for admin display. */
  title: string
  /** Resolved unit price in kuruş — wholesale when applicable, retail otherwise. */
  unitAmount: number
  variantID?: number | string
}

const idOf = (value: unknown): number | string | undefined => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return (value as { id: number | string }).id
  }
  return undefined
}

/**
 * Resolve the price of every cart line, server side, from the products and variants
 * themselves rather than from anything the client sent.
 *
 * `useWholesale` decides which tier is read; the wholesale field is only present on
 * the document for admins and approved customers, so the lookups here run with
 * `overrideAccess: true` deliberately — this is server-trusted pricing, never a
 * response the customer sees. Retail is the fallback whenever a product has no
 * wholesale price of its own.
 *
 * Shared by the Carts `beforeChange` hook (which sets `cart.subtotal`, and therefore
 * what gets charged) and by the payment adapters that need a per-line breakdown.
 */
export const resolveCartLines = async ({
  items,
  req,
  useWholesale,
}: {
  items: CartItem[]
  req: PayloadRequest
  useWholesale: boolean
}): Promise<CartLine[]> => {
  const lines: CartLine[] = []

  for (const item of items) {
    const quantity = item.quantity || 0
    const productID = idOf(item.product)
    const variantID = idOf(item.variant)

    if (!productID || quantity <= 0) continue

    let unitAmount = 0
    let title = ''

    if (variantID) {
      const variant = await req.payload.findByID({
        id: variantID,
        collection: 'variants',
        depth: 0,
        overrideAccess: true,
        req,
        select: { title: true, [PRICE_FIELD]: true, [WHOLESALE_PRICE_FIELD]: true },
      })

      const wholesale = (variant as Record<string, unknown>)?.[WHOLESALE_PRICE_FIELD]
      const retail = (variant as Record<string, unknown>)?.[PRICE_FIELD]

      unitAmount = Number(
        (useWholesale && typeof wholesale === 'number' ? wholesale : retail) ?? 0,
      )
      title = typeof variant?.title === 'string' ? variant.title : ''
    } else {
      const product = await req.payload.findByID({
        id: productID,
        collection: 'products',
        depth: 0,
        overrideAccess: true,
        req,
        select: { title: true, [PRICE_FIELD]: true, [WHOLESALE_PRICE_FIELD]: true },
      })

      const wholesale = (product as Record<string, unknown>)?.[WHOLESALE_PRICE_FIELD]
      const retail = (product as Record<string, unknown>)?.[PRICE_FIELD]

      unitAmount = Number(
        (useWholesale && typeof wholesale === 'number' ? wholesale : retail) ?? 0,
      )
      title = typeof product?.title === 'string' ? product.title : ''
    }

    lines.push({
      lineAmount: unitAmount * quantity,
      productID,
      quantity,
      title: title || 'Ürün',
      unitAmount,
      ...(variantID ? { variantID } : {}),
    })
  }

  return lines
}

export const sumLines = (lines: CartLine[]): number =>
  lines.reduce((total, line) => total + line.lineAmount, 0)
