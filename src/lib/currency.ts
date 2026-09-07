import type { Currency } from '@payloadcms/plugin-ecommerce/types'

/**
 * The shop sells in Turkish Lira only. Amounts are stored as integers in kuruş
 * (1 TRY = 100 kuruş), matching the plugin's "minor units" convention.
 */
export const TRY: Currency = {
  code: 'TRY',
  decimals: 2,
  label: 'Türk Lirası',
  symbol: '₺',
}

export const PRICE_FIELD = 'priceInTRY' as const
export const WHOLESALE_PRICE_FIELD = 'wholesalePriceInTRY' as const

export const formatTRY = (kurus: number): string =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(kurus / 100)
