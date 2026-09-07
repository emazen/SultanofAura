'use client'

import { Message } from '@/components/Message'
import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import React, { useCallback, FormEvent } from 'react'
import { useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import { Address } from '@/payload-types'
import { BANK_TRANSFER } from '@/payments/bankTransfer'

export type BankTransferPaymentData = {
  transactionID: string | number
  reference: string
  amount: number
  currency: string
  bank: { bankName: string; accountHolder: string; iban: string }
}

type Props = {
  customerEmail?: string
  billingAddress?: Partial<Address>
  shippingAddress?: Partial<Address>
  paymentData: BankTransferPaymentData
  setProcessingPayment: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Havale / EFT step: show the shop's bank details and the reference code, then let
 * the customer place the order. The owner marks the transaction paid in the admin
 * when the transfer lands.
 */
export const CheckoutForm: React.FC<Props> = ({
  customerEmail,
  shippingAddress,
  paymentData,
  setProcessingPayment,
}) => {
  const [error, setError] = React.useState<null | string>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()
  const { clearCart } = useCart()
  const { confirmOrder } = usePayments()

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setIsLoading(true)
      setProcessingPayment(true)

      try {
        const confirmResult = await confirmOrder(BANK_TRANSFER, {
          additionalData: {
            transactionID: paymentData.transactionID,
            shippingAddress,
            ...(customerEmail ? { customerEmail } : {}),
          },
        })

        if (
          confirmResult &&
          typeof confirmResult === 'object' &&
          'orderID' in confirmResult &&
          confirmResult.orderID
        ) {
          const accessToken =
            'accessToken' in confirmResult ? (confirmResult.accessToken as string) : ''
          const queryParams = new URLSearchParams()
          if (customerEmail) queryParams.set('email', customerEmail)
          if (accessToken) queryParams.set('accessToken', accessToken)
          const qs = queryParams.toString()

          clearCart()
          router.push(`/orders/${confirmResult.orderID}${qs ? `?${qs}` : ''}`)
          return
        }
        throw new Error('Sipariş oluşturulamadı.')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Bir hata oluştu.'
        setError(msg)
        setIsLoading(false)
        setProcessingPayment(false)
      }
    },
    [confirmOrder, paymentData.transactionID, shippingAddress, customerEmail, clearCart, router, setProcessingPayment],
  )

  const { bank, reference, amount } = paymentData

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && <Message error={error} />}

      <div className="rounded-lg border bg-accent/40 p-6 flex flex-col gap-3">
        <p className="text-sm text-primary/70">
          Aşağıdaki hesaba havale/EFT yapın. Açıklama kısmına mutlaka referans kodunu yazın; ödeme
          hesabımıza geçtiğinde siparişiniz kargoya verilir.
        </p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-primary/60">Banka</dt>
          <dd className="font-medium">{bank.bankName}</dd>
          <dt className="text-primary/60">Hesap sahibi</dt>
          <dd className="font-medium">{bank.accountHolder}</dd>
          <dt className="text-primary/60">IBAN</dt>
          <dd className="font-mono font-medium select-all">{bank.iban}</dd>
          <dt className="text-primary/60">Tutar</dt>
          <dd className="font-medium">
            <Price amount={amount} as="span" />
          </dd>
          <dt className="text-primary/60">Referans kodu</dt>
          <dd className="font-mono font-semibold tracking-wider select-all">{reference}</dd>
        </dl>
      </div>

      <div className="flex gap-4">
        <Button disabled={isLoading} type="submit" variant="default">
          {isLoading ? 'Sipariş oluşturuluyor...' : 'Siparişi tamamla'}
        </Button>
      </div>
    </form>
  )
}
