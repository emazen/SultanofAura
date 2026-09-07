/**
 * Import the shop's Trendyol catalogue into Payload.
 *
 *   pnpm import:trendyol            # live import via Trendyol Seller API
 *   pnpm import:trendyol --dry-run  # fetch + map, print, write nothing
 *   pnpm import:trendyol --file=export.json   # use a saved API response instead of calling Trendyol
 *
 * Env (see .env.example): TRENDYOL_SUPPLIER_ID, TRENDYOL_API_KEY, TRENDYOL_API_SECRET,
 * optional TRENDYOL_WHOLESALE_RATIO (default 0.6 → wholesale = 60% of retail, rounded to 50 kuruş).
 *
 * Mapping: one Trendyol `productMainId` = one Payload product. When several barcodes share
 * a productMainId they become variants (variant type "secenek", option label taken from the
 * attribute that differs — e.g. Koku / Renk). Prices are stored in kuruş. Images are
 * downloaded once and attached to the media collection; re-running the script updates
 * prices/stock and skips images that already exist (matched by Trendyol barcode).
 *
 * NOTE: written against the Trendyol Seller API docs; not yet run against the shop's live
 * account (needs her API key). Use --file with a saved response to iterate safely.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config'

type TrendyolProduct = {
  id?: string
  barcode: string
  title: string
  productMainId: string
  brand?: string
  categoryName?: string
  quantity: number
  stockCode?: string
  description?: string
  listPrice: number
  salePrice: number
  vatRate?: number
  images?: { url: string }[]
  attributes?: { attributeName?: string; attributeValue?: string; customAttributeValue?: string }[]
  approved?: boolean
  archived?: boolean
  onSale?: boolean
}

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
)
const DRY_RUN = args.get('dry-run') === 'true'
const FILE = args.get('file')
const RATIO = Number(process.env.TRENDYOL_WHOLESALE_RATIO || 0.6)

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

const toKurus = (tl: number) => Math.round(tl * 100)
const wholesaleFromRetail = (kurus: number) => Math.round((kurus * RATIO) / 50) * 50

const stripHtml = (html = '') =>
  html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

const richText = (text: string) => ({
  root: {
    type: 'root',
    children: text
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => ({
        type: 'paragraph',
        children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text: line, version: 1 }],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        version: 1,
      })),
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})

async function fetchAllFromTrendyol(): Promise<TrendyolProduct[]> {
  const sellerId = process.env.TRENDYOL_SUPPLIER_ID
  const key = process.env.TRENDYOL_API_KEY
  const secret = process.env.TRENDYOL_API_SECRET
  if (!sellerId || !key || !secret) {
    throw new Error('TRENDYOL_SUPPLIER_ID, TRENDYOL_API_KEY and TRENDYOL_API_SECRET are required (or pass --file=)')
  }
  const auth = Buffer.from(`${key}:${secret}`).toString('base64')
  const out: TrendyolProduct[] = []
  let page = 0
  for (;;) {
    const url = `https://apigw.trendyol.com/integration/product/sellers/${sellerId}/products?page=${page}&size=200&approved=true`
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        'User-Agent': `${sellerId} - SelfIntegration`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Trendyol ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { content: TrendyolProduct[]; totalPages: number }
    out.push(...json.content)
    page += 1
    if (page >= (json.totalPages ?? 1)) break
  }
  return out
}

async function downloadImage(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`image ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const name = url.split('/').pop()?.split('?')[0] || `trendyol-${Date.now()}.jpg`
  const mimetype = res.headers.get('content-type') || 'image/jpeg'
  return { name, data: buf, mimetype, size: buf.byteLength }
}

async function ensureCategory(payload: Payload, title: string) {
  const slug = slugify(title)
  const existing = await payload.find({ collection: 'categories', where: { slug: { equals: slug } }, limit: 1 })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({ collection: 'categories', data: { title, slug } })
}

async function ensureMedia(payload: Payload, url: string, alt: string) {
  const name = url.split('/').pop()?.split('?')[0]
  if (name) {
    const existing = await payload.find({ collection: 'media', where: { filename: { equals: name } }, limit: 1 })
    if (existing.docs[0]) return existing.docs[0]
  }
  const file = await downloadImage(url)
  return payload.create({ collection: 'media', data: { alt }, file })
}

/** Which attribute differs between items of the same productMainId? (Koku, Renk, Beden…) */
function variantAxis(items: TrendyolProduct[]): string | null {
  if (items.length < 2) return null
  const names = new Set<string>()
  for (const it of items) for (const a of it.attributes ?? []) if (a.attributeName) names.add(a.attributeName)
  for (const n of names) {
    const values = new Set(
      items.map((it) => it.attributes?.find((a) => a.attributeName === n)?.attributeValue ?? it.attributes?.find((a) => a.attributeName === n)?.customAttributeValue),
    )
    if (values.size === items.length) return n
  }
  return null
}

async function main() {
  const raw: TrendyolProduct[] = FILE ? JSON.parse(readFileSync(FILE, 'utf8')).content ?? JSON.parse(readFileSync(FILE, 'utf8')) : await fetchAllFromTrendyol()
  const live = raw.filter((p) => !p.archived && p.approved !== false)
  console.log(`Fetched ${raw.length} Trendyol items, ${live.length} live.`)

  const groups = new Map<string, TrendyolProduct[]>()
  for (const p of live) {
    const key = p.productMainId || p.barcode
    groups.set(key, [...(groups.get(key) ?? []), p])
  }
  console.log(`→ ${groups.size} products (${live.length - groups.size} extra barcodes become variants).`)

  if (DRY_RUN) {
    for (const [key, items] of groups) {
      const axis = variantAxis(items)
      const base = items[0]!
      console.log(
        `- ${base.title}  [${key}]  ₺${base.salePrice} → toptan ₺${wholesaleFromRetail(toKurus(base.salePrice)) / 100}` +
          (axis ? `  variants by ${axis}: ${items.map((i) => i.attributes?.find((a) => a.attributeName === axis)?.attributeValue).join(', ')}` : ''),
      )
    }
    return
  }

  const payload = await getPayload({ config })

  let variantType = (await payload.find({ collection: 'variantTypes', where: { name: { equals: 'secenek' } }, limit: 1 })).docs[0]
  if (!variantType) variantType = await payload.create({ collection: 'variantTypes', data: { name: 'secenek', label: 'Seçenek' } })

  let created = 0
  let updated = 0

  for (const [key, items] of groups) {
    const base = items[0]!
    const axis = variantAxis(items)
    const slug = slugify(base.title)
    const category = base.categoryName ? await ensureCategory(payload, base.categoryName) : null

    const gallery = []
    for (const img of (base.images ?? []).slice(0, 6)) {
      try {
        const media = await ensureMedia(payload, img.url, base.title)
        gallery.push({ image: media.id })
      } catch (e) {
        console.warn(`  image failed for ${base.barcode}: ${(e as Error).message}`)
      }
    }

    const retail = toKurus(base.salePrice)
    const description = stripHtml(base.description)
    const data: Record<string, unknown> = {
      title: base.title,
      slug,
      _status: 'published',
      trendyolProductMainId: key,
      trendyolBarcode: base.barcode,
      categories: category ? [category.id] : [],
      description: richText(description || base.title),
      gallery: gallery.length ? gallery : undefined,
      layout: [],
      meta: {
        title: `${base.title} | Sultan of Aura`,
        description: (description || base.title).slice(0, 155),
        image: gallery[0]?.image,
      },
      priceInTRYEnabled: true,
      priceInTRY: retail,
      wholesalePriceInTRY: wholesaleFromRetail(retail),
      minWholesaleQuantity: 1,
      ...(axis
        ? { enableVariants: true, variantTypes: [variantType.id] }
        : { inventory: base.quantity }),
    }

    const existing = await payload.find({ collection: 'products', where: { slug: { equals: slug } }, limit: 1 })
    let product
    if (existing.docs[0]) {
      product = await payload.update({ collection: 'products', id: existing.docs[0].id, data: data as any, context: { disableRevalidate: true } })
      updated += 1
    } else {
      product = await payload.create({ collection: 'products', data: data as any, context: { disableRevalidate: true } })
      created += 1
    }

    if (axis) {
      for (const it of items) {
        const attr = it.attributes?.find((a) => a.attributeName === axis)
        const label = attr?.attributeValue ?? attr?.customAttributeValue ?? it.barcode
        const value = slugify(`${label}`)
        let option = (await payload.find({ collection: 'variantOptions', where: { and: [{ value: { equals: value } }, { variantType: { equals: variantType.id } }] }, limit: 1 })).docs[0]
        if (!option) option = await payload.create({ collection: 'variantOptions', data: { label, value, variantType: variantType.id } })

        const vRetail = toKurus(it.salePrice)
        const vData = {
          product: product.id,
          options: [option.id],
          title: `${base.title} – ${label}`,
          inventory: it.quantity,
          priceInTRYEnabled: true,
          priceInTRY: vRetail,
          wholesalePriceInTRY: wholesaleFromRetail(vRetail),
          trendyolBarcode: it.barcode,
        }
        const existingV = await payload.find({ collection: 'variants', where: { and: [{ product: { equals: product.id } }, { options: { contains: option.id } }] }, limit: 1 })
        if (existingV.docs[0]) await payload.update({ collection: 'variants', id: existingV.docs[0].id, data: vData as any })
        else await payload.create({ collection: 'variants', data: vData as any })
      }
    }
    console.log(`  ${existing.docs[0] ? 'updated' : 'created'}: ${base.title}`)
  }

  console.log(`Done. ${created} created, ${updated} updated.`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
