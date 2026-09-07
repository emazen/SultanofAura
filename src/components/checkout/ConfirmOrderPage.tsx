'use client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Message } from '@/components/Message'
import { Button } from '@/components/ui/button'
import { IYZICO } from '@/payments/iyzico/client'
import { useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

/**
 * Landing page after iyzico sends the customer back. The payment itself was already
 * verified server side in the callback; this turns the paid transaction into an
 * order and forwards to the order page.
 *
 * Confirming is idempotent on the server (a second call returns the existing
 * order), but we still guard against React running the effect twice.
 */
export const ConfirmOrderPage: React.FC = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { clearCart } = useCart()
  const { confirmOrder } = usePayments()
  const [error, setError] = useState<null | string>(null)
  const hasRun = useRef(false)

  const token = searchParams.get('token')

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const run = async () => {
      if (!token) {
        setError('Ödeme bilgisi bulunamadı.')
        return
      }

      let customerEmail: null | string = null
      try {
        customerEmail = window.sessionStorage.getItem('soa:iyzico:email')
      } catch {
        // Storage blocked; logged-in customers do not need it.
      }

      try {
        const result = await confirmOrder(IYZICO, {
          additionalData: {
            token,
            ...(customerEmail ? { customerEmail } : {}),
          },
        })

        if (result && typeof result === 'object' && 'orderID' in result && result.orderID) {
          const accessToken = 'accessToken' in result ? (result.accessToken as string) : ''
          const queryParams = new URLSearchParams()
          if (customerEmail) queryParams.set('email', customerEmail)
          if (accessToken) queryParams.set('accessToken', accessToken)
          const qs = queryParams.toString()

          try {
            window.sessionStorage.removeItem('soa:iyzico:email')
          } catch {
            // ignore
          }

          clearCart()
          router.push(`/orders/${result.orderID}${qs ? `?${qs}` : ''}`)
          return
        }

        throw new Error('Sipariş oluşturulamadı.')
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Bir hata oluştu.'
        // The plugin surfaces server errors as a JSON string.
        let message = raw
        try {
          const parsed = JSON.parse(raw) as { message?: string }
          if (parsed?.message) message = parsed.message
        } catch {
          // Not JSON — use as is.
        }
        setError(message)
      }
    }

    void run()
  }, [token, confirmOrder, clearCart, router])

  if (error) {
    return (
      <div className="flex w-full flex-col items-start gap-4 py-12">
        <h2 className="text-2xl font-medium">Siparişiniz tamamlanamadı</h2>
        <Message error={error} />
        <p className="text-primary/70">
          Kartınızdan tutar çekildiyse endişelenmeyin — ekibimiz işlemi kontrol edip sizinle
          iletişime geçecek.
        </p>
        <div className="flex gap-4">
          <Button asChild variant="default">
            <Link href="/checkout">Ödemeye dön</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/find-order">Siparişimi bul</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full items-center justify-center py-12">
      <div className="prose dark:prose-invert mb-8 max-w-none self-center text-center">
        <p>Ödemeniz doğrulanıyor, siparişiniz oluşturuluyor…</p>
      </div>
      <LoadingSpinner />
    </div>
  )
}
