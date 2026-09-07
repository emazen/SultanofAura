import type { CollectionSlug, File, GlobalSlug, Payload, PayloadRequest } from 'payload'

import type { Category, Media, Product } from '@/payload-types'

import { contactFormData } from './contact-form'
import { contactPageData } from './contact-page'
import { homePageData } from './home'
import { seedCategories, seedProducts, type SeedProduct } from './catalogue'

const collections: CollectionSlug[] = [
  'categories',
  'media',
  'pages',
  'products',
  'forms',
  'form-submissions',
  'variants',
  'variantOptions',
  'variantTypes',
  'carts',
  'transactions',
  'addresses',
  'orders',
]

const globals: GlobalSlug[] = ['header', 'footer']

const SEED_EMAILS = ['musteri@example.com', 'toptan@example.com', 'basvuru@example.com']

/**
 * Generates a simple SVG placeholder so seeding never depends on the network.
 * Real product photos will replace these via the admin or the Trendyol import.
 */
const placeholderImage = (label: string, color: string): File => {
  const safe = label.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="${color}"/>
  <rect x="80" y="80" width="1040" height="1040" rx="48" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="6"/>
  <text x="600" y="620" font-family="Georgia, serif" font-size="56" fill="#fff" text-anchor="middle" opacity="0.92">${safe}</text>
  <text x="600" y="700" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#fff" text-anchor="middle" opacity="0.6">Sultan of Aura</text>
</svg>`
  const data = Buffer.from(svg, 'utf8')
  return {
    name: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`,
    data,
    mimetype: 'image/svg+xml',
    size: data.byteLength,
  }
}

const richText = (text: string) => ({
  root: {
    type: 'root' as const,
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        textFormat: 0,
        textStyle: '',
        version: 1,
      },
    ],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info('Seeding database (Sultan of Aura dev catalogue)...')

  payload.logger.info(`— Clearing collections and globals...`)
  await Promise.all(
    globals.map((global) =>
      payload.updateGlobal({
        slug: global,
        data: { navItems: [] },
        depth: 0,
        context: { disableRevalidate: true },
      }),
    ),
  )

  for (const collection of collections) {
    await payload.db.deleteMany({ collection, req, where: {} })
    if (payload.collections[collection].config.versions) {
      await payload.db.deleteVersions({ collection, req, where: {} })
    }
  }

  await payload.delete({
    collection: 'users',
    depth: 0,
    where: { email: { in: SEED_EMAILS } },
  })

  payload.logger.info(`— Seeding customers (retail, approved wholesale, pending applicant)...`)
  const [retailCustomer, wholesaleCustomer] = await Promise.all([
    payload.create({
      collection: 'users',
      req,
      data: {
        name: 'Ayşe Perakende',
        email: 'musteri@example.com',
        password: 'password',
        roles: ['customer'],
      },
    }),
    payload.create({
      collection: 'users',
      req,
      data: {
        name: 'Mehmet Toptan',
        email: 'toptan@example.com',
        password: 'password',
        roles: ['customer'],
        wholesale: {
          status: 'approved',
          companyName: 'Aura Hediyelik Ltd. Şti.',
          taxNumber: '1234567890',
          taxOffice: 'Kadıköy',
          phone: '+90 555 000 00 00',
          appliedAt: new Date().toISOString(),
          reviewedAt: new Date().toISOString(),
        },
      },
    }),
    payload.create({
      collection: 'users',
      req,
      data: {
        name: 'Zeynep Başvuru',
        email: 'basvuru@example.com',
        password: 'password',
        roles: ['customer'],
        wholesale: {
          status: 'pending',
          companyName: 'Zeynep Dekor',
          taxNumber: '12345678901',
          taxOffice: 'Beşiktaş',
          phone: '+90 555 111 11 11',
          appliedAt: new Date().toISOString(),
        },
      },
    }),
  ])

  payload.logger.info(`— Seeding categories...`)
  const categoryBySlug = new Map<string, Category>()
  for (const c of seedCategories) {
    const doc = await payload.create({ collection: 'categories', data: { title: c.title, slug: c.slug } })
    categoryBySlug.set(c.slug, doc)
  }

  payload.logger.info(`— Seeding variant type (koku)...`)
  const scentType = await payload.create({
    collection: 'variantTypes',
    data: { name: 'scent', label: 'Koku' },
  })

  payload.logger.info(`— Seeding products...`)
  const products: Product[] = []
  let heroImage: Media | null = null

  for (const p of seedProducts) {
    const image = await payload.create({
      collection: 'media',
      data: { alt: p.title },
      file: placeholderImage(p.title, p.color),
    })
    if (!heroImage) heroImage = image

    const base = {
      _status: 'published' as const,
      title: p.title,
      slug: p.slug,
      categories: [categoryBySlug.get(p.category)!.id],
      description: richText(p.description),
      gallery: [{ image: image.id }],
      layout: [],
      meta: { title: p.seoTitle, description: p.seoDescription, image: image.id },
      minWholesaleQuantity: p.minWholesaleQuantity ?? 1,
    }

    if (p.variants) {
      const options = []
      for (const o of p.variants.options) {
        options.push(
          await payload.create({
            collection: 'variantOptions',
            data: { ...o, variantType: scentType.id },
          }),
        )
      }

      const product = await payload.create({
        collection: 'products',
        depth: 0,
        data: {
          ...base,
          enableVariants: true,
          variantTypes: [scentType.id],
          priceInTRYEnabled: true,
          priceInTRY: p.retail,
          wholesalePriceInTRY: p.wholesale,
        } as any,
      })

      for (const option of options) {
        await payload.create({
          collection: 'variants',
          depth: 0,
          data: {
            product: product.id,
            options: [option.id],
            title: `${p.title} – ${option.label}`,
            inventory: Math.round(p.inventory / options.length),
            priceInTRYEnabled: true,
            priceInTRY: p.retail,
            wholesalePriceInTRY: p.wholesale,
          } as any,
        })
      }
      products.push(product)
    } else {
      const product = await payload.create({
        collection: 'products',
        depth: 0,
        data: {
          ...base,
          inventory: p.inventory,
          priceInTRYEnabled: true,
          priceInTRY: p.retail,
          wholesalePriceInTRY: p.wholesale,
        } as any,
      })
      products.push(product)
    }
  }

  // Related products: same category
  for (const product of products) {
    const cat = typeof product.categories?.[0] === 'object' ? product.categories[0].id : product.categories?.[0]
    const related = products
      .filter((o) => o.id !== product.id)
      .filter((o) => (typeof o.categories?.[0] === 'object' ? o.categories[0].id : o.categories?.[0]) === cat)
      .slice(0, 4)
      .map((o) => o.id)
    if (related.length) {
      await payload.update({
        collection: 'products',
        id: product.id,
        depth: 0,
        data: { relatedProducts: related },
        context: { disableRevalidate: true },
      })
    }
  }

  payload.logger.info(`— Seeding contact form & pages...`)
  const contactForm = await payload.create({ collection: 'forms', depth: 0, data: contactFormData() })

  await Promise.all([
    payload.create({
      collection: 'pages',
      depth: 0,
      data: homePageData({ contentImage: heroImage!, metaImage: heroImage!, featured: products.slice(0, 3) }),
    }),
    payload.create({
      collection: 'pages',
      depth: 0,
      data: contactPageData({ contactForm }),
    }),
  ])

  payload.logger.info(`— Seeding addresses...`)
  const trAddress = {
    firstName: 'Mehmet',
    lastName: 'Toptan',
    phone: '+90 555 000 00 00',
    company: 'Aura Hediyelik Ltd. Şti.',
    addressLine1: 'Caferağa Mah. Moda Cad. No:12',
    city: 'İstanbul',
    state: 'Kadıköy',
    postalCode: '34710',
    country: 'TR',
  }
  await payload.create({
    collection: 'addresses',
    depth: 0,
    data: { customer: wholesaleCustomer.id, ...trAddress } as any,
  })
  await payload.create({
    collection: 'addresses',
    depth: 0,
    data: {
      customer: retailCustomer.id,
      firstName: 'Ayşe',
      lastName: 'Perakende',
      phone: '+90 555 222 22 22',
      addressLine1: 'Bağdat Cad. No:100',
      city: 'İstanbul',
      state: 'Kadıköy',
      postalCode: '34728',
      country: 'TR',
    } as any,
  })

  payload.logger.info(`— Seeding a sample wholesale order awaiting havale...`)
  const kuksa = products.find((p) => p.slug === 'ahsap-kuksa-bardak')!
  const paloSet = products.find((p) => p.slug === 'palo-santo-arinma-ve-enerji-dengeleme-seti')!
  const items = [
    { product: kuksa.id, quantity: 4 },
    { product: paloSet.id, quantity: 4 },
  ]
  const amount = 4 * 24500 + 4 * 21000

  const transaction = await payload.create({
    collection: 'transactions',
    data: {
      currency: 'TRY',
      customer: wholesaleCustomer.id,
      paymentMethod: 'bankTransfer',
      bankTransfer: { reference: 'SOA-SEED-0001' },
      status: 'pending',
      amount,
      items,
      billingAddress: trAddress,
    } as any,
  })

  await payload.create({
    collection: 'orders',
    data: {
      amount,
      currency: 'TRY',
      customer: wholesaleCustomer.id,
      shippingAddress: trAddress,
      items,
      status: 'processing',
      transactions: [transaction.id],
    } as any,
  })

  payload.logger.info(`— Seeding globals...`)
  await Promise.all([
    payload.updateGlobal({
      slug: 'header',
      data: {
        navItems: [
          { link: { type: 'custom', label: 'Ürünler', url: '/shop' } },
          { link: { type: 'custom', label: 'Toptan', url: '/toptan-basvuru' } },
          { link: { type: 'custom', label: 'İletişim', url: '/contact' } },
        ],
      },
    }),
    payload.updateGlobal({
      slug: 'footer',
      data: {
        navItems: [
          { link: { type: 'custom', label: 'Sipariş sorgula', url: '/find-order' } },
          { link: { type: 'custom', label: 'Toptan satış', url: '/toptan-basvuru' } },
          { link: { type: 'custom', label: 'Instagram', newTab: true, url: 'https://www.instagram.com/sultanofaura/' } },
          { link: { type: 'custom', label: 'Trendyol mağazamız', newTab: true, url: 'https://www.trendyol.com/sr?mid=1190557' } },
        ],
      },
    }),
  ])

  payload.logger.info('Seeded database successfully!')
  payload.logger.info('Test accounts (password: "password"): musteri@example.com (perakende), toptan@example.com (onaylı toptan), basvuru@example.com (onay bekliyor)')
}
