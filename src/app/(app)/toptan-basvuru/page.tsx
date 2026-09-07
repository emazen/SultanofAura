import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { RenderParams } from '@/components/RenderParams'
import { WholesaleApplicationForm } from '@/components/forms/WholesaleApplicationForm'
import React from 'react'

export default function WholesaleApplicationPage() {
  return (
    <div className="container py-16 flex flex-col gap-8">
      <RenderParams />
      <div className="prose dark:prose-invert max-w-none">
        <h1>Toptan Satış Başvurusu</h1>
        <p className="lead">
          Mağazanız, kafeniz veya e-ticaret siteniz için tütsü, kuksa ve dekor ürünlerimizi toptan
          fiyatlarla alın. Vergi numaranızla başvurun; onaydan sonra tüm fiyatlar sitede toptan olarak
          görünür.
        </p>
      </div>
      <WholesaleApplicationForm />
    </div>
  )
}

export const metadata: Metadata = {
  description:
    'Sultan of Aura ürünlerini toptan fiyatlarla almak için vergi numaranızla başvurun.',
  openGraph: mergeOpenGraph({ title: 'Toptan Satış Başvurusu', url: '/toptan-basvuru' }),
  title: 'Toptan Satış Başvurusu',
}
