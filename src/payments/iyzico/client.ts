import type { PaymentAdapterClient } from '@payloadcms/plugin-ecommerce/types'

/**
 * Client-safe half of the iyzico adapter: the method name, the label shown at
 * checkout and the shape of what `initiatePayment` returns. Nothing here imports
 * node crypto or reads server secrets, so it is safe in client components.
 */

export const IYZICO = 'iyzico'

export const IYZICO_LABEL = 'Kredi / banka kartı'

export type IyzicoPaymentData = {
  amount: number
  /** iyzico's own `<script>` snippet; injecting it opens the payment form. */
  checkoutFormContent?: string
  currency: string
  /** Hosted fallback, used when the inline form cannot be rendered. */
  paymentPageUrl?: string
  token: string
  transactionID: number | string
}

/**
 * Card payments are only offered when the deployment is actually configured for
 * iyzico. The server adapter is always registered (so the endpoints and the admin
 * fields exist), but the checkout UI hides the option unless this is switched on.
 */
export const isIyzicoEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_IYZICO_ENABLED === 'true'

export const iyzicoAdapterClient = (): PaymentAdapterClient => ({
  name: IYZICO,
  label: IYZICO_LABEL,
  confirmOrder: true,
  initiatePayment: true,
})
