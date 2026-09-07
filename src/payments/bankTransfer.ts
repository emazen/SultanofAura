import type { PaymentAdapter, PaymentAdapterClient } from '@payloadcms/plugin-ecommerce/types'
import type { GroupField } from 'payload'

/**
 * Havale / EFT (bank transfer) payment adapter.
 *
 * Flow:
 *  1. initiatePayment  -> creates a `pending` transaction with a snapshot of the cart
 *                         and returns the shop's bank details + a reference code.
 *  2. confirmOrder     -> customer clicks "Siparişi tamamla"; we create the order in
 *                         `processing` status, mark the cart purchased, and leave the
 *                         transaction `pending` until the owner sees the money arrive
 *                         and marks it `succeeded` in the admin panel.
 *
 * This is the standard way Turkish B2B / toptan orders are paid, so it ships first.
 * Card payments (iyzico) will be a second adapter next to this one.
 */

type BankDetails = {
  bankName: string
  accountHolder: string
  iban: string
}

type Props = {
  bank: BankDetails
  label?: string
}

export const BANK_TRANSFER = 'bankTransfer'

const makeReference = () =>
  `SOA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

export const bankTransferAdapter = ({ bank, label = 'Havale / EFT' }: Props): PaymentAdapter => {
  const group: GroupField = {
    name: BANK_TRANSFER,
    type: 'group',
    label: 'Havale / EFT',
    admin: {
      condition: (data) => data?.paymentMethod === BANK_TRANSFER,
    },
    fields: [
      { name: 'reference', type: 'text', label: 'Açıklama / referans kodu', index: true },
      {
        name: 'receivedAt',
        type: 'date',
        label: 'Ödeme alındığı tarih',
        admin: { date: { pickerAppearance: 'dayAndTime' } },
      },
    ],
  }

  return {
    name: BANK_TRANSFER,
    label,
    group,

    initiatePayment: async ({ data, req, transactionsSlug }) => {
      const { cart, currency, customerEmail, billingAddress } = data
      const amount = cart.subtotal

      if (!cart?.items?.length) throw new Error('Sepet boş.')
      if (!amount || amount <= 0) throw new Error('Geçersiz tutar.')
      if (!customerEmail) throw new Error('E-posta adresi gerekli.')

      const reference = makeReference()

      const items = cart.items.map((item) => {
        const { product, variant, ...rest } = item
        return {
          ...rest,
          product: typeof product === 'object' ? product.id : product,
          quantity: item.quantity,
          ...(variant ? { variant: typeof variant === 'object' ? variant.id : variant } : {}),
        }
      })

      const transaction = await req.payload.create({
        collection: transactionsSlug as 'transactions',
        data: {
          ...(req.user ? { customer: req.user.id } : { customerEmail }),
          amount,
          billingAddress,
          cart: cart.id,
          currency,
          items,
          paymentMethod: BANK_TRANSFER,
          status: 'pending',
          [BANK_TRANSFER]: { reference },
        } as any,
        req,
      })

      return {
        message: 'Havale bilgileri oluşturuldu.',
        transactionID: transaction.id,
        reference,
        amount,
        currency,
        bank,
      }
    },

    confirmOrder: async ({ cartsSlug = 'carts', data, ordersSlug = 'orders', req, transactionsSlug = 'transactions' }) => {
      const transactionID = data.transactionID as string | number | undefined
      if (!transactionID) throw new Error('İşlem kimliği gerekli.')

      const transaction = await req.payload.findByID({
        id: transactionID,
        collection: transactionsSlug as 'transactions',
        depth: 0,
        req,
      })
      if (!transaction) throw new Error('İşlem bulunamadı.')
      if (transaction.status !== 'pending') throw new Error('Bu işlem zaten sonuçlandırılmış.')

      // Guard: the transaction must belong to the caller
      const txCustomer =
        typeof transaction.customer === 'object' ? transaction.customer?.id : transaction.customer
      if (req.user) {
        if (txCustomer && txCustomer !== req.user.id) throw new Error('Yetkisiz işlem.')
      } else if (transaction.customerEmail !== data.customerEmail) {
        throw new Error('Yetkisiz işlem.')
      }

      const cartID = typeof transaction.cart === 'object' ? transaction.cart?.id : transaction.cart

      const order = await req.payload.create({
        collection: ordersSlug as 'orders',
        data: {
          amount: transaction.amount,
          currency: transaction.currency,
          ...(req.user ? { customer: req.user.id } : { customerEmail: transaction.customerEmail }),
          items: transaction.items,
          shippingAddress: data.shippingAddress,
          status: 'processing',
          transactions: [transaction.id],
        } as any,
        req,
      })

      if (cartID) {
        await req.payload.update({
          id: cartID,
          collection: cartsSlug as 'carts',
          data: { purchasedAt: new Date().toISOString() },
          req,
        })
      }

      await req.payload.update({
        id: transaction.id,
        collection: transactionsSlug as 'transactions',
        data: { order: order.id } as any,
        req,
      })

      return {
        message: 'Sipariş alındı. Havale onaylandığında kargoya verilecektir.',
        orderID: order.id,
        transactionID: transaction.id,
        ...((order as any).accessToken ? { accessToken: (order as any).accessToken } : {}),
      }
    },
  }
}

export const bankTransferAdapterClient = (): PaymentAdapterClient => ({
  name: BANK_TRANSFER,
  label: 'Havale / EFT',
  confirmOrder: true,
  initiatePayment: true,
})
