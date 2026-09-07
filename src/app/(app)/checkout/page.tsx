import type { Metadata } from 'next'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'

import { CheckoutPage } from '@/components/checkout/CheckoutPage'

export default function Checkout() {
  return (
    <div className="container min-h-[90vh] flex">
      <h1 className="sr-only">Ödeme</h1>
      <CheckoutPage />
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Siparişinizi tamamlayın.',
  openGraph: mergeOpenGraph({
    title: 'Ödeme',
    url: '/checkout',
  }),
  title: 'Ödeme',
  robots: { index: false, follow: false },
}
