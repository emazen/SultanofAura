import type { CollectionBeforeChangeHook } from 'payload'
import type { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'

import { isWholesaleApproved } from '@/access/wholesale'
import { checkRole } from '@/access/utilities'
import { PRICE_FIELD, WHOLESALE_PRICE_FIELD } from '@/lib/currency'

/**
 * Runs AFTER the plugin's own subtotal hook. If the cart belongs to an approved
 * wholesale customer, recompute the subtotal from wholesale prices (falling back to
 * retail for any product without a wholesale price). Because the payment
 * initiation endpoint trusts `cart.subtotal`, this is the single place where the
 * two-tier pricing actually changes what gets charged.
 */
const applyWholesalePricing: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data?.items?.length) return data

  let customerID = typeof data.customer === 'object' ? data.customer?.id : data.customer

  // A logged-in, non-admin user may only ever own their own cart. This closes the
  // hole where a retail account posts `customer: <approved wholesaler id>` to get
  // wholesale pricing on a cart it then cannot even read.
  if (req.user && !checkRole(['admin'], req.user) && customerID && customerID !== req.user.id) {
    data.customer = req.user.id
    customerID = req.user.id
  }

  if (!customerID) return data

  // The requesting user is the usual case; fall back to loading the customer
  // (e.g. admin editing a cart, or server-side merges).
  let customer = req.user && req.user.id === customerID ? req.user : null
  if (!customer) {
    customer = await req.payload.findByID({
      collection: 'users',
      id: customerID,
      depth: 0,
      overrideAccess: true,
    })
  }
  if (!isWholesaleApproved(customer)) return data

  let subtotal = 0
  for (const item of data.items) {
    const qty = item.quantity || 0
    if (item.variant) {
      const id = typeof item.variant === 'object' ? item.variant.id : item.variant
      const variant = await req.payload.findByID({
        collection: 'variants',
        id,
        depth: 0,
        overrideAccess: true,
        select: { [PRICE_FIELD]: true, [WHOLESALE_PRICE_FIELD]: true },
      })
      const price = (variant as any)?.[WHOLESALE_PRICE_FIELD] ?? (variant as any)?.[PRICE_FIELD] ?? 0
      subtotal += price * qty
    } else {
      const id = typeof item.product === 'object' ? item.product.id : item.product
      const product = await req.payload.findByID({
        collection: 'products',
        id,
        depth: 0,
        overrideAccess: true,
        select: { [PRICE_FIELD]: true, [WHOLESALE_PRICE_FIELD]: true },
      })
      const price = (product as any)?.[WHOLESALE_PRICE_FIELD] ?? (product as any)?.[PRICE_FIELD] ?? 0
      subtotal += price * qty
    }
  }

  data.subtotal = subtotal
  data.pricingTier = 'wholesale'
  return data
}

export const CartsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  fields: [
    ...defaultCollection.fields,
    {
      name: 'pricingTier',
      type: 'select',
      defaultValue: 'retail',
      options: [
        { label: 'Perakende', value: 'retail' },
        { label: 'Toptan', value: 'wholesale' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
  hooks: {
    ...defaultCollection.hooks,
    beforeChange: [
      ...(defaultCollection.hooks?.beforeChange ?? []),
      // Reset to retail each time; the wholesale hook flips it when applicable.
      ({ data }) => {
        if (data) data.pricingTier = 'retail'
        return data
      },
      applyWholesalePricing,
    ],
  },
})
