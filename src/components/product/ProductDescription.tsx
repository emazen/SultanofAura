'use client'
import type { Product, Variant } from '@/payload-types'

import { RichText } from '@/components/RichText'
import { AddToCart } from '@/components/Cart/AddToCart'
import { Price } from '@/components/Price'
import { TierPrice } from '@/components/TierPrice'
import { useIsWholesale, resolvePrice } from '@/hooks/usePricing'
import { useAuth } from '@/providers/Auth'
import Link from 'next/link'
import React, { Suspense } from 'react'

import { VariantSelector } from './VariantSelector'
import { StockIndicator } from '@/components/product/StockIndicator'

export function ProductDescription({ product }: { product: Product }) {
  const isWholesaleUser = useIsWholesale()
  const { user } = useAuth()
  const hasVariants = product.enableVariants && Boolean(product.variants?.docs?.length)

  let priceNode: React.ReactNode = null

  if (hasVariants) {
    const amounts = (product.variants?.docs ?? [])
      .filter((v): v is Variant => Boolean(v) && typeof v === 'object')
      .map((v) => resolvePrice(v, isWholesaleUser).amount)
      .filter((a): a is number => typeof a === 'number')
      .sort((a, b) => a - b)

    if (amounts.length) {
      priceNode = (
        <span className="inline-flex items-center gap-2">
          {isWholesaleUser && (
            <span className="text-[10px] uppercase tracking-widest rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5">
              Toptan
            </span>
          )}
          <Price
            as="span"
            lowestAmount={amounts[0]!}
            highestAmount={amounts[amounts.length - 1]!}
          />
        </span>
      )
    }
  } else {
    priceNode = <TierPrice item={product} />
  }

  const minQty = isWholesaleUser ? product.minWholesaleQuantity ?? 1 : 1
  const wholesaleStatus = user?.wholesale?.status ?? 'none'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-medium">{product.title}</h1>
        <div className="uppercase font-mono">{priceNode}</div>
      </div>

      {isWholesaleUser && minQty > 1 && (
        <p className="text-sm text-primary/60">Toptan siparişlerde minimum adet: {minQty}</p>
      )}

      {!isWholesaleUser && (
        <p className="text-sm text-primary/60">
          {wholesaleStatus === 'pending' ? (
            'Toptan başvurunuz inceleniyor. Onaylandığında toptan fiyatlar burada görünecek.'
          ) : (
            <>
              Toptan alım yapıyor musunuz?{' '}
              <Link className="underline" href="/toptan-basvuru">
                Vergi numaranızla başvurun
              </Link>
              , toptan fiyatları görün.
            </>
          )}
        </p>
      )}

      {product.description ? (
        <RichText className="" data={product.description} enableGutter={false} />
      ) : null}
      <hr />
      {hasVariants && (
        <>
          <Suspense fallback={null}>
            <VariantSelector product={product} />
          </Suspense>

          <hr />
        </>
      )}
      <div className="flex items-center justify-between">
        <Suspense fallback={null}>
          <StockIndicator product={product} />
        </Suspense>
      </div>

      <div className="flex items-center justify-between">
        <Suspense fallback={null}>
          <AddToCart product={product} />
        </Suspense>
      </div>
    </div>
  )
}
