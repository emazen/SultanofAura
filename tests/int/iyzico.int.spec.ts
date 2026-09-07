import { describe, expect, it } from 'vitest'

import {
  formatPrice,
  hmacHex,
  parsePriceToKurus,
  verifyInitializeSignature,
  verifyRetrieveSignature,
} from '@/payments/iyzico/api'
import { buildBasketItems } from '@/payments/iyzico/basket'

const SECRET = 'sandbox-secret-key'

const line = (overrides: Partial<Parameters<typeof buildBasketItems>[0]['lines'][number]> = {}) => ({
  lineAmount: 10000,
  productID: 1,
  quantity: 1,
  title: 'Tütsü',
  unitAmount: 10000,
  ...overrides,
})

describe('iyzico prices', () => {
  it('formats kuruş as the decimal string iyzico expects', () => {
    expect(formatPrice(12345)).toBe('123.45')
    expect(formatPrice(10000)).toBe('100.00')
    expect(formatPrice(5)).toBe('0.05')
  })

  it('parses iyzico prices back to kuruş', () => {
    expect(parsePriceToKurus('123.45')).toBe(12345)
    expect(parsePriceToKurus(100)).toBe(10000)
    expect(parsePriceToKurus('abc')).toBeNull()
  })
})

describe('iyzico basket', () => {
  it('always adds up to the cart subtotal', () => {
    const lines = [line({ lineAmount: 3333 }), line({ lineAmount: 3333 }), line({ lineAmount: 3333 })]
    const subtotal = 10000 // the cart charges a kuruş more than the lines add up to

    const items = buildBasketItems({ lines, subtotal })
    const total = items.reduce((sum, item) => sum + Math.round(Number(item.price) * 100), 0)

    expect(total).toBe(subtotal)
  })

  it('reconciles a wholesale subtotal that is lower than the line prices', () => {
    const lines = [line({ lineAmount: 20000 }), line({ lineAmount: 10000 })]
    const items = buildBasketItems({ lines, subtotal: 25000 })
    const total = items.reduce((sum, item) => sum + Math.round(Number(item.price) * 100), 0)

    expect(total).toBe(25000)
    // The difference lands on the largest line, never on a cheap one.
    expect(items[0]!.price).toBe('150.00')
    expect(items[1]!.price).toBe('100.00')
  })

  it('falls back to a single line when nothing is priced', () => {
    const items = buildBasketItems({ lines: [line({ lineAmount: 0 })], subtotal: 4500 })

    expect(items).toHaveLength(1)
    expect(items[0]!.price).toBe('45.00')
  })

  it('uses the variant id when the line has one', () => {
    const items = buildBasketItems({ lines: [line({ variantID: 42 })], subtotal: 10000 })
    expect(items[0]!.id).toBe('42')
  })
})

describe('iyzico signature verification', () => {
  it('accepts a correctly signed initialize response', () => {
    const data = {
      conversationId: 'SOA-12',
      token: 'token-abc',
    }

    expect(
      verifyInitializeSignature({
        data: { ...data, signature: hmacHex('SOA-12:token-abc', SECRET) },
        secretKey: SECRET,
      }),
    ).toBe(true)
  })

  it('rejects an initialize response signed for a different token', () => {
    expect(
      verifyInitializeSignature({
        data: {
          conversationId: 'SOA-12',
          signature: hmacHex('SOA-12:someone-elses-token', SECRET),
          token: 'token-abc',
        },
        secretKey: SECRET,
      }),
    ).toBe(false)
  })

  const retrieveFields = {
    basketId: '7',
    conversationId: 'SOA-12',
    currency: 'TRY',
    paidPrice: 123.5,
    paymentId: 987654,
    paymentStatus: 'SUCCESS',
    price: 123.5,
    token: 'token-abc',
  }

  const signRetrieve = (paidPrice: string, price: string) =>
    hmacHex(
      ['SUCCESS', '987654', 'TRY', '7', 'SOA-12', paidPrice, price, 'token-abc'].join(':'),
      SECRET,
    )

  it('accepts a retrieve response signed with trailing zeros stripped', () => {
    const raw = JSON.stringify({ ...retrieveFields })

    expect(
      verifyRetrieveSignature({
        data: { ...retrieveFields, signature: signRetrieve('123.5', '123.5') },
        raw,
        secretKey: SECRET,
      }),
    ).toBe(true)
  })

  it('accepts a retrieve response whose prices were serialized as 123.50', () => {
    // JSON.parse turns 123.50 into 123.5, so the raw literal is what matches.
    const raw = '{"paymentStatus":"SUCCESS","paymentId":987654,"currency":"TRY","basketId":"7","conversationId":"SOA-12","paidPrice":123.50,"price":123.50,"token":"token-abc"}'

    expect(
      verifyRetrieveSignature({
        data: { ...retrieveFields, signature: signRetrieve('123.50', '123.50') },
        raw,
        secretKey: SECRET,
      }),
    ).toBe(true)
  })

  it('accepts a whole amount signed as 100.0', () => {
    const fields = { ...retrieveFields, paidPrice: 100, price: 100 }
    const raw = JSON.stringify(fields)
    const signature = hmacHex(
      ['SUCCESS', '987654', 'TRY', '7', 'SOA-12', '100.0', '100.0', 'token-abc'].join(':'),
      SECRET,
    )

    expect(verifyRetrieveSignature({ data: { ...fields, signature }, raw, secretKey: SECRET })).toBe(
      true,
    )
  })

  it('rejects a forged callback that claims a payment succeeded', () => {
    const forged = { ...retrieveFields, signature: 'deadbeef' }

    expect(
      verifyRetrieveSignature({ data: forged, raw: JSON.stringify(forged), secretKey: SECRET }),
    ).toBe(false)
  })

  it('rejects a response where the amount was tampered with after signing', () => {
    const raw = JSON.stringify({ ...retrieveFields, paidPrice: 1 })

    expect(
      verifyRetrieveSignature({
        data: { ...retrieveFields, paidPrice: 1, signature: signRetrieve('123.5', '123.5') },
        raw,
        secretKey: SECRET,
      }),
    ).toBe(false)
  })

  it('rejects a response with no signature at all', () => {
    expect(
      verifyRetrieveSignature({
        data: { ...retrieveFields },
        raw: JSON.stringify(retrieveFields),
        secretKey: SECRET,
      }),
    ).toBe(false)
  })
})
