'use client'

import type { IyzicoPaymentData } from '@/payments/iyzico/client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Message } from '@/components/Message'
import { Price } from '@/components/Price'
import React, { useEffect, useRef } from 'react'

type Props = {
  customerEmail?: string
  paymentData: IyzicoPaymentData
}

/**
 * Card step. `checkoutFormContent` is iyzico's own markup + script, which draws the
 * card form (3D Secure and the installment table included) into the container div
 * below. It must be inserted with `createContextualFragment` — `innerHTML` would put
 * the script in the DOM without ever running it.
 *
 * Once the customer pays, iyzico POSTs their browser to
 * /api/payments/iyzico/callback, which redirects on to /checkout/confirm-order.
 */
export const IyzicoCheckoutForm: React.FC<Props> = ({ customerEmail, paymentData }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const content = paymentData.checkoutFormContent

  // Guests come back from iyzico on a fresh page load, so the e-mail they checked
  // out with has to be waiting for the confirm step.
  useEffect(() => {
    if (!customerEmail) return
    try {
      window.sessionStorage.setItem('soa:iyzico:email', customerEmail)
    } catch {
      // Private mode / blocked storage: the confirm page falls back to asking.
    }
  }, [customerEmail])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !content) return

    try {
      container.appendChild(document.createRange().createContextualFragment(content))
    } catch (error) {
      console.error('iyzico ödeme formu yüklenemedi', error)
    }

    return () => {
      container.replaceChildren()
    }
  }, [content])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-lg border bg-accent/40 p-4">
        <span className="text-primary/70 text-sm">Ödenecek tutar</span>
        <Price amount={paymentData.amount} as="span" className="text-xl font-medium" />
      </div>

      {content ? (
        <>
          <div className="text-primary/60 flex items-center gap-3 text-sm">
            <LoadingSpinner size="small" />
            <span>Kart formu yükleniyor…</span>
          </div>
          {/* iyzico looks for this id when the snippet runs. */}
          <div className="responsive" id="iyzipay-checkout-form" ref={containerRef} />
        </>
      ) : (
        <Message
          error={
            paymentData.paymentPageUrl
              ? 'Ödeme formu bu sayfada açılamadı; güvenli ödeme sayfasında devam edebilirsiniz.'
              : 'Ödeme formu yüklenemedi. Lütfen tekrar deneyin.'
          }
        />
      )}

      {paymentData.paymentPageUrl && (
        <p className="text-primary/60 text-sm">
          Form açılmazsa{' '}
          <a className="underline" href={paymentData.paymentPageUrl} rel="noreferrer">
            iyzico güvenli ödeme sayfasını
          </a>{' '}
          kullanabilirsiniz.
        </p>
      )}
    </div>
  )
}
