import type { Field } from 'payload'

import { wholesaleOrAdminFieldAccess } from '@/access/wholesale'
import { TRY, WHOLESALE_PRICE_FIELD } from '@/lib/currency'

const currenciesConfig = { defaultCurrency: TRY.code, supportedCurrencies: [TRY] }

/**
 * Toptan (wholesale) price, stored in kuruş like the retail price. Uses the
 * plugin's own PriceInput/PriceCell components so the admin sees "₺" formatting,
 * and is read-restricted so it never reaches retail visitors.
 */
export const wholesalePriceFields = (): Field[] => [
  {
    type: 'row',
    fields: [
      {
        name: WHOLESALE_PRICE_FIELD,
        type: 'number',
        label: 'Toptan fiyat (TRY)',
        min: 0,
        access: { read: wholesaleOrAdminFieldAccess },
        admin: {
          description: 'Boş bırakılırsa toptan müşteriler perakende fiyatı görür.',
          components: {
            Cell: {
              clientProps: { currenciesConfig, currency: TRY },
              path: '@payloadcms/plugin-ecommerce/client#PriceCell',
            },
            Field: {
              clientProps: { currenciesConfig, currency: TRY },
              path: '@payloadcms/plugin-ecommerce/rsc#PriceInput',
            },
          },
        },
      },
      {
        name: 'minWholesaleQuantity',
        type: 'number',
        label: 'Minimum toptan adedi',
        min: 1,
        defaultValue: 1,
        access: { read: wholesaleOrAdminFieldAccess },
      },
    ],
  },
]

/** Identifiers linking a Payload product/variant back to its Trendyol listing. */
export const trendyolFields = (): Field[] => [
  {
    type: 'row',
    admin: { position: 'sidebar' },
    fields: [
      { name: 'trendyolProductMainId', type: 'text', label: 'Trendyol Model Kodu', index: true, admin: { readOnly: true } },
      { name: 'trendyolBarcode', type: 'text', label: 'Trendyol Barkod', index: true, admin: { readOnly: true } },
    ],
  },
]
