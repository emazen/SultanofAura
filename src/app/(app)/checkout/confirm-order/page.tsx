import type { Metadata } from 'next'

import { ConfirmOrderPage } from '@/components/checkout/ConfirmOrderPage'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React, { Suspense } from 'react'

export default function ConfirmOrder() {
  return (
    <div className="container flex min-h-[90vh]">
      <h1 className="sr-only">Ödeme onayı</h1>
      <Suspense fallback={<React.Fragment />}>
        <ConfirmOrderPage />
      </Suspense>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Ödemeniz doğrulanıyor.',
  openGraph: mergeOpenGraph({
    title: 'Ödeme onayı',
    url: '/checkout/confirm-order',
  }),
  robots: { follow: false, index: false },
  title: 'Ödeme onayı',
}
