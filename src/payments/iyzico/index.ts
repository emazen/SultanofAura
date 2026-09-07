import type { PaymentAdapter } from '@payloadcms/plugin-ecommerce/types'
import type { GroupField, PayloadRequest } from 'payload'

import type { Address, Transaction, User } from '@/payload-types'

import { isWholesaleApproved } from '@/access/wholesale'
import { resolveCartLines, sumLines } from '@/lib/cartPricing'
import { getServerSideURL } from '@/utilities/getURL'

import {
  CF_INITIALIZE_PATH,
  CF_RETRIEVE_PATH,
  formatPrice,
  getIyzicoConfig,
  type IyzicoConfig,
  iyzicoRequest,
  parsePriceToKurus,
  verifyInitializeSignature,
  verifyRetrieveSignature,
} from './api'
import { buildBasketItems } from './basket'
import { IYZICO, IYZICO_LABEL } from './client'

export { IYZICO, IYZICO_LABEL } from './client'

/**
 * iyzico Checkout Form (CF) adapter — card payments, with 3D Secure and the
 * installment table handled on iyzico's side. See `docs/PAYMENTS.md`.
 *
 * Flow:
 *  1. initiatePayment  -> create a `pending` transaction, call CF initialize, hand
 *                         the form snippet back to the browser.
 *  2. iyzico POSTs the customer back to `/api/payments/iyzico/callback` with a token.
 *     We re-query iyzico (never trust the callback body), verify the response
 *     signature and the amount, mark the transaction `succeeded`, and redirect the
 *     browser to /checkout/confirm-order.
 *  3. confirmOrder     -> looks the transaction up by token and creates the order.
 *                         Safe to call twice: it returns the existing order.
 *
 * The bank transfer adapter is untouched; both are registered side by side.
 */

type Props = {
  label?: string
}

const REVIEW_MESSAGE =
  'Ödemeniz iyzico tarafından inceleniyor. Onaylandığında siparişiniz oluşturulacak.'

const group: GroupField = {
  name: IYZICO,
  type: 'group',
  label: 'iyzico (kart)',
  admin: {
    condition: (data) => data?.paymentMethod === IYZICO,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'token',
          type: 'text',
          label: 'Checkout Form token',
          index: true,
          admin: { readOnly: true },
        },
        {
          name: 'conversationId',
          type: 'text',
          label: 'Conversation ID',
          index: true,
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'paymentId', type: 'text', label: 'iyzico ödeme no', admin: { readOnly: true } },
        { name: 'installment', type: 'number', label: 'Taksit', admin: { readOnly: true } },
        {
          name: 'paidAmount',
          type: 'number',
          label: 'Çekilen tutar (kuruş)',
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'cardFamily', type: 'text', label: 'Kart', admin: { readOnly: true } },
        { name: 'lastFourDigits', type: 'text', label: 'Son 4 hane', admin: { readOnly: true } },
        {
          name: 'fraudStatus',
          type: 'number',
          label: 'Fraud durumu',
          admin: {
            readOnly: true,
            description: '1 onaylandı · 0 incelemede · -1 reddedildi',
          },
        },
      ],
    },
    {
      name: 'note',
      type: 'text',
      label: 'Not',
      admin: {
        readOnly: true,
        description: 'Ödeme reddedildiyse ya da tutar uyuşmadıysa sebebi burada yazar.',
      },
    },
    {
      name: 'shippingAddressSnapshot',
      type: 'json',
      label: 'Teslimat adresi (ödeme anındaki)',
      admin: {
        readOnly: true,
        description:
          'Kart ödemesinde müşteri iyzico sayfasına gidip döndüğü için teslimat adresi ödeme başlarken burada saklanır.',
      },
    },
  ],
}

const enabledInstallments = (): number[] => {
  const raw = process.env.IYZICO_ENABLED_INSTALLMENTS || '1'
  const parsed = raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)

  return parsed.length ? parsed : [1]
}

const clientIP = (req: PayloadRequest): string | undefined => {
  const forwarded = req.headers?.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim()
  return req.headers?.get('x-real-ip') || undefined
}

const addressToIyzico = (address?: null | Partial<Address>, fallbackName = 'Müşteri') => ({
  address:
    [address?.addressLine1, address?.addressLine2].filter(Boolean).join(' ') || 'Adres belirtilmedi',
  city: address?.city || 'İstanbul',
  contactName:
    [address?.firstName, address?.lastName].filter(Boolean).join(' ') ||
    address?.company ||
    fallbackName,
  country: 'Turkey',
  ...(address?.postalCode ? { zipCode: address.postalCode } : {}),
})

const findTransactionByToken = async ({
  req,
  token,
  transactionsSlug,
}: {
  req: PayloadRequest
  token: string
  transactionsSlug: string
}): Promise<null | Transaction> => {
  // The iyzico callback is an unauthenticated cross-site POST (no cookies), so this
  // lookup cannot run as the customer. The token itself — a long random value only
  // iyzico and this browser session hold — is what authorises the settlement.
  const result = await req.payload.find({
    collection: transactionsSlug as 'transactions',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: { 'iyzico.token': { equals: token } },
  })

  return (result.docs[0] as Transaction | undefined) || null
}

type SettleResult = {
  message: string
  status: 'failed' | 'review' | 'succeeded'
}

/**
 * Ask iyzico what actually happened to a payment and write the outcome onto the
 * transaction. Called from the callback endpoint and again from `confirmOrder`, so
 * a lost callback still resolves; it is a no-op once the transaction is settled.
 */
const settleTransaction = async ({
  config,
  req,
  transaction,
  transactionsSlug,
}: {
  config: IyzicoConfig
  req: PayloadRequest
  transaction: Transaction
  transactionsSlug: string
}): Promise<SettleResult> => {
  if (transaction.status === 'succeeded') {
    return { message: 'Ödeme alındı.', status: 'succeeded' }
  }

  const token = transaction.iyzico?.token
  if (!token) return { message: 'İşlem kaydında iyzico token yok.', status: 'failed' }

  const { data, raw } = await iyzicoRequest({
    body: {
      conversationId: transaction.iyzico?.conversationId || undefined,
      locale: 'tr',
      token,
    },
    config,
    uriPath: CF_RETRIEVE_PATH,
  })

  if (!verifyRetrieveSignature({ data, raw, secretKey: config.secretKey })) {
    req.payload.logger.error(
      { transactionID: transaction.id },
      'iyzico: response signature doğrulanamadı, ödeme kabul edilmedi.',
    )
    return { message: 'Ödeme doğrulanamadı.', status: 'failed' }
  }

  const paymentStatus = typeof data.paymentStatus === 'string' ? data.paymentStatus : ''
  const fraudStatus = typeof data.fraudStatus === 'number' ? data.fraudStatus : 1
  const paidAmount = parsePriceToKurus(data.paidPrice)

  const common = {
    cardFamily: typeof data.cardFamily === 'string' ? data.cardFamily : undefined,
    conversationId: transaction.iyzico?.conversationId || undefined,
    fraudStatus,
    installment: typeof data.installment === 'number' ? data.installment : undefined,
    lastFourDigits: typeof data.lastFourDigits === 'string' ? data.lastFourDigits : undefined,
    paidAmount: paidAmount ?? undefined,
    paymentId: data.paymentId ? String(data.paymentId) : undefined,
    token,
  }

  const update = async (status: Transaction['status'], note?: string) => {
    await req.payload.update({
      id: transaction.id,
      collection: transactionsSlug as 'transactions',
      data: {
        status,
        [IYZICO]: { ...common, ...(note ? { note } : {}) },
      } as Partial<Transaction>,
      overrideAccess: true,
      req,
    })
  }

  if (data.status === 'failure' || (paymentStatus && paymentStatus !== 'SUCCESS')) {
    const note =
      (typeof data.errorMessage === 'string' && data.errorMessage) ||
      `Ödeme durumu: ${paymentStatus || 'bilinmiyor'}`
    await update('failed', note)
    return { message: note, status: 'failed' }
  }

  // Amount tampering / partial capture: never turn this into an order automatically.
  if (paidAmount !== null && transaction.amount && paidAmount !== transaction.amount) {
    const note = `Çekilen tutar (${paidAmount}) sepet tutarıyla (${transaction.amount}) uyuşmuyor.`
    req.payload.logger.error({ transactionID: transaction.id }, `iyzico: ${note}`)
    await update('pending', note)
    return { message: 'Ödeme tutarı doğrulanamadı, ekibimiz kontrol edecek.', status: 'review' }
  }

  // 0 = iyzico is still reviewing the payment; the money is not settled yet.
  if (fraudStatus === 0) {
    await update('pending', REVIEW_MESSAGE)
    return { message: REVIEW_MESSAGE, status: 'review' }
  }

  if (fraudStatus === -1) {
    await update('failed', 'iyzico ödemeyi reddetti (fraud).')
    return { message: 'Ödeme reddedildi.', status: 'failed' }
  }

  await update('succeeded')
  return { message: 'Ödeme alındı.', status: 'succeeded' }
}

const readCallbackToken = async (req: PayloadRequest): Promise<string | undefined> => {
  const fromQuery = req.searchParams?.get('token')
  if (fromQuery) return fromQuery

  try {
    const body = await req.text?.()
    if (!body) return undefined

    if ((req.headers?.get('content-type') || '').includes('application/json')) {
      const parsed = JSON.parse(body) as { token?: unknown }
      return typeof parsed.token === 'string' ? parsed.token : undefined
    }

    return new URLSearchParams(body).get('token') || undefined
  } catch {
    return undefined
  }
}

export const iyzicoAdapter = ({ label = IYZICO_LABEL }: Props = {}): PaymentAdapter => ({
  name: IYZICO,
  label,
  group,

  endpoints: [
    {
      // /api/payments/iyzico/callback — iyzico POSTs the customer's browser here.
      handler: async (req) => {
        const redirectTo = (path: string) =>
          new Response(null, { headers: { Location: `${getServerSideURL()}${path}` }, status: 303 })

        const token = await readCallbackToken(req)
        if (!token) {
          req.payload.logger.error('iyzico callback: token yok.')
          return redirectTo('/checkout?payment=error')
        }

        try {
          const config = getIyzicoConfig()
          const transaction = await findTransactionByToken({
            req,
            token,
            transactionsSlug: 'transactions',
          })

          if (!transaction) {
            req.payload.logger.error('iyzico callback: token ile işlem bulunamadı.')
            return redirectTo('/checkout?payment=error')
          }

          const result = await settleTransaction({
            config,
            req,
            transaction,
            transactionsSlug: 'transactions',
          })

          if (result.status === 'failed') {
            return redirectTo('/checkout?payment=failed')
          }

          // Both `succeeded` and `review` land on the confirm page, which tells the
          // customer what happened and creates the order when the payment is good.
          return redirectTo(`/checkout/confirm-order?token=${encodeURIComponent(token)}`)
        } catch (error) {
          req.payload.logger.error(error, 'iyzico callback işlenemedi.')
          return redirectTo('/checkout?payment=error')
        }
      },
      method: 'post',
      path: '/callback',
    },
  ],

  initiatePayment: async ({ data, req, transactionsSlug }) => {
    const config = getIyzicoConfig()
    const { billingAddress, cart, currency, customerEmail, shippingAddress } = data
    const amount = cart.subtotal

    if (!cart?.items?.length) throw new Error('Sepet boş.')
    if (!amount || amount <= 0) throw new Error('Geçersiz tutar.')
    if (!customerEmail) throw new Error('E-posta adresi gerekli.')
    if (!billingAddress) throw new Error('Fatura adresi gerekli.')

    const user = (req.user as null | User) || null

    const items = cart.items.map((item) => {
      const { product, variant, ...rest } = item
      return {
        ...rest,
        product: typeof product === 'object' ? product?.id : product,
        quantity: item.quantity,
        ...(variant ? { variant: typeof variant === 'object' ? variant.id : variant } : {}),
      }
    })

    const transaction = await req.payload.create({
      collection: transactionsSlug as 'transactions',
      data: {
        ...(user ? { customer: user.id } : { customerEmail }),
        amount,
        billingAddress,
        cart: cart.id,
        currency,
        items,
        paymentMethod: IYZICO,
        status: 'pending',
        [IYZICO]: {
          // The customer leaves the site for iyzico, so the address chosen at
          // checkout has to survive the round trip somewhere server side.
          shippingAddressSnapshot: shippingAddress || billingAddress,
        },
      } as never,
      req,
    })

    const conversationId = `SOA-${transaction.id}`

    try {
      const lines = await resolveCartLines({
        items: cart.items,
        req,
        useWholesale: isWholesaleApproved(user),
      })

      if (sumLines(lines) !== amount) {
        req.payload.logger.warn(
          { cartID: cart.id, lines: sumLines(lines), subtotal: amount },
          'iyzico: satır toplamı sepet toplamıyla uyuşmadı, fark en büyük satıra eklendi.',
        )
      }

      const { data: response, raw } = await iyzicoRequest({
        body: {
          basketId: String(cart.id),
          basketItems: buildBasketItems({ lines, subtotal: amount }),
          billingAddress: addressToIyzico(billingAddress),
          buyer: {
            city: billingAddress.city || 'İstanbul',
            country: 'Turkey',
            email: customerEmail,
            gsmNumber: billingAddress.phone || undefined,
            id: String(user?.id ?? `guest-${transaction.id}`),
            identityNumber:
              (isWholesaleApproved(user) && user?.wholesale?.taxNumber) ||
              process.env.IYZICO_DEFAULT_IDENTITY_NUMBER ||
              '11111111111',
            ip: clientIP(req),
            name: billingAddress.firstName || 'Müşteri',
            registrationAddress:
              [billingAddress.addressLine1, billingAddress.addressLine2]
                .filter(Boolean)
                .join(' ') || 'Adres belirtilmedi',
            surname: billingAddress.lastName || '-',
            ...(billingAddress.postalCode ? { zipCode: billingAddress.postalCode } : {}),
          },
          callbackUrl: `${getServerSideURL()}/api/payments/iyzico/callback`,
          conversationId,
          currency,
          enabledInstallments: enabledInstallments(),
          locale: 'tr',
          paidPrice: formatPrice(amount),
          paymentGroup: 'PRODUCT',
          price: formatPrice(amount),
          shippingAddress: addressToIyzico(shippingAddress || billingAddress),
        },
        config,
        uriPath: CF_INITIALIZE_PATH,
      })

      const token = typeof response.token === 'string' ? response.token : undefined

      if (response.status !== 'success' || !token) {
        throw new Error(
          (typeof response.errorMessage === 'string' && response.errorMessage) ||
            'iyzico ödeme formu başlatılamadı.',
        )
      }

      if (
        !verifyInitializeSignature({
          data: { conversationId, signature: response.signature, token },
          secretKey: config.secretKey,
        })
      ) {
        req.payload.logger.error({ raw }, 'iyzico: initialize imzası doğrulanamadı.')
        throw new Error('iyzico yanıtı doğrulanamadı.')
      }

      await req.payload.update({
        id: transaction.id,
        collection: transactionsSlug as 'transactions',
        data: { [IYZICO]: { conversationId, token } } as never,
        req,
      })

      return {
        amount,
        checkoutFormContent:
          typeof response.checkoutFormContent === 'string'
            ? response.checkoutFormContent
            : undefined,
        currency,
        message: 'Ödeme formu hazır.',
        paymentPageUrl:
          typeof response.paymentPageUrl === 'string' ? response.paymentPageUrl : undefined,
        token,
        transactionID: transaction.id,
      }
    } catch (error) {
      await req.payload.update({
        id: transaction.id,
        collection: transactionsSlug as 'transactions',
        data: {
          status: 'failed',
          [IYZICO]: {
            conversationId,
            note: error instanceof Error ? error.message.slice(0, 250) : 'Bilinmeyen hata',
          },
        } as never,
        overrideAccess: true,
        req,
      })

      throw error
    }
  },

  confirmOrder: async ({
    cartsSlug = 'carts',
    data,
    ordersSlug = 'orders',
    req,
    transactionsSlug = 'transactions',
  }) => {
    const token = typeof data.token === 'string' ? data.token : undefined
    if (!token) throw new Error('Ödeme token bilgisi gerekli.')

    const config = getIyzicoConfig()
    const transaction = await findTransactionByToken({ req, token, transactionsSlug })
    if (!transaction) throw new Error('İşlem bulunamadı.')

    // A logged-in customer may only ever confirm their own transaction. For guests
    // the iyzico token is the proof, since there is no session to check against.
    const txCustomer =
      typeof transaction.customer === 'object' ? transaction.customer?.id : transaction.customer
    if (req.user && txCustomer && txCustomer !== req.user.id) {
      throw new Error('Yetkisiz işlem.')
    }

    // Idempotency: a refresh of the confirm page must not create a second order.
    if (transaction.order) {
      const orderID =
        typeof transaction.order === 'object' ? transaction.order.id : transaction.order
      return {
        message: 'Sipariş zaten oluşturulmuş.',
        orderID,
        transactionID: transaction.id,
      }
    }

    const settled = await settleTransaction({ config, req, transaction, transactionsSlug })
    if (settled.status !== 'succeeded') throw new Error(settled.message)

    const cartID = typeof transaction.cart === 'object' ? transaction.cart?.id : transaction.cart
    const snapshot = transaction.iyzico?.shippingAddressSnapshot as null | Partial<Address>

    const order = await req.payload.create({
      collection: ordersSlug as 'orders',
      data: {
        amount: transaction.amount,
        currency: transaction.currency,
        ...(transaction.customer
          ? { customer: txCustomer }
          : { customerEmail: transaction.customerEmail }),
        items: transaction.items,
        shippingAddress: snapshot || data.shippingAddress,
        status: 'processing',
        transactions: [transaction.id],
      } as never,
      overrideAccess: true,
      req,
    })

    if (cartID) {
      await req.payload.update({
        id: cartID,
        collection: cartsSlug as 'carts',
        data: { purchasedAt: new Date().toISOString() },
        overrideAccess: true,
        req,
      })
    }

    await req.payload.update({
      id: transaction.id,
      collection: transactionsSlug as 'transactions',
      data: { order: order.id } as never,
      overrideAccess: true,
      req,
    })

    return {
      message: 'Ödemeniz alındı, siparişiniz oluşturuldu.',
      orderID: order.id,
      transactionID: transaction.id,
      ...((order as { accessToken?: string }).accessToken
        ? { accessToken: (order as { accessToken?: string }).accessToken }
        : {}),
    }
  },
})
