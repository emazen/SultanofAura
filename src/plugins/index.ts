import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'

import { bankTransferAdapter } from '@/payments/bankTransfer'
import { iyzicoAdapter } from '@/payments/iyzico'
import { CartsCollection } from '@/collections/Carts'
import { trendyolFields, wholesalePriceFields } from '@/fields/wholesalePriceField'
import { TRY } from '@/lib/currency'

import { Page, Product } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { ProductsCollection } from '@/collections/Products'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isDocumentOwner } from '@/access/isDocumentOwner'

const generateTitle: GenerateTitle<Product | Page> = ({ doc }) => {
  const site = process.env.SITE_NAME || 'Sultan of Aura'
  return doc?.title ? `${doc.title} | ${site}` : site
}

const generateURL: GenerateURL<Product | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formSubmissionOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        group: 'Content',
      },
    },
    formOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
        create: isAdmin,
      },
      admin: {
        group: 'Content',
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  ecommercePlugin({
    access: {
      adminOnlyFieldAccess,
      adminOrPublishedStatus,
      customerOnlyFieldAccess,
      isAdmin,
      isDocumentOwner,
    },
    customers: {
      slug: 'users',
    },
    addresses: {
      // Domestic shipping only for now; add countries here when e-ihracat starts.
      supportedCountries: [{ label: 'Türkiye', value: 'TR' }],
    },
    currencies: {
      defaultCurrency: TRY.code,
      supportedCurrencies: [TRY],
    },
    carts: {
      allowGuestCarts: true,
      cartsCollectionOverride: CartsCollection,
    },
    orders: {
      ordersCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        fields: [
          ...defaultCollection.fields,
          {
            name: 'shipping',
            type: 'group',
            label: 'Kargo',
            fields: [
              {
                type: 'row',
                fields: [
                  {
                    name: 'carrier',
                    type: 'select',
                    label: 'Kargo firması',
                    options: [
                      { label: 'Yurtiçi Kargo', value: 'yurtici' },
                      { label: 'Aras Kargo', value: 'aras' },
                      { label: 'MNG Kargo', value: 'mng' },
                      { label: 'Sürat Kargo', value: 'surat' },
                      { label: 'PTT Kargo', value: 'ptt' },
                      { label: 'Diğer', value: 'other' },
                    ],
                  },
                  { name: 'trackingNumber', type: 'text', label: 'Takip numarası' },
                ],
              },
              {
                name: 'shippedAt',
                type: 'date',
                label: 'Kargoya verildiği tarih',
                admin: { date: { pickerAppearance: 'dayAndTime' } },
              },
            ],
          },
          {
            name: 'accessToken',
            type: 'text',
            unique: true,
            index: true,
            admin: {
              position: 'sidebar',
              readOnly: true,
            },
            hooks: {
              beforeValidate: [
                ({ value, operation }) => {
                  if (operation === 'create' || !value) {
                    return crypto.randomUUID()
                  }
                  return value
                },
              ],
            },
          },
        ],
      }),
    },
    payments: {
      paymentMethods: [
        bankTransferAdapter({
          bank: {
            bankName: process.env.BANK_NAME || 'Banka adı (env: BANK_NAME)',
            accountHolder: process.env.BANK_ACCOUNT_HOLDER || 'Hesap sahibi (env: BANK_ACCOUNT_HOLDER)',
            iban: process.env.BANK_IBAN || 'TR00 0000 0000 0000 0000 0000 00',
          },
        }),
        // Card payments. Registered unconditionally so the endpoints and the admin
        // fields always exist; the checkout UI only offers it when
        // NEXT_PUBLIC_IYZICO_ENABLED is set (see src/payments/iyzico/client.ts).
        iyzicoAdapter(),
      ],
    },
    products: {
      productsCollectionOverride: ProductsCollection,
      variants: {
        variantsCollectionOverride: ({ defaultCollection }) => ({
          ...defaultCollection,
          fields: [
            ...defaultCollection.fields,
            ...wholesalePriceFields(),
            { name: 'trendyolBarcode', type: 'text', label: 'Trendyol Barkod', index: true, admin: { readOnly: true } },
          ],
        }),
      },
    },
  }),
]
