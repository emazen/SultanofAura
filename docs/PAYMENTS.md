# Ödeme adapter'ları

`@payloadcms/plugin-ecommerce` her ödeme yöntemini bir `PaymentAdapter` olarak alır:

- `initiatePayment({ data: { cart, currency, customerEmail, billingAddress, shippingAddress }, req, transactionsSlug })`
  → `transactions` koleksiyonunda `pending` kayıt oluşturur, istemciye gerekli veriyi döner.
  Plugin, çağrıdan önce sepetteki her ürünün fiyatını/stokunu doğrular; `cart.subtotal` bizim
  Carts hook'umuz tarafından (perakende/toptan) hesaplanmış tutardır — **adapter bu tutarı kullanır**.
- `confirmOrder({ data, req, ... })` → `orders` kaydı açar, sepeti `purchasedAt` ile kapatır.
- İstemci tarafı: `usePayments().initiatePayment(name, { additionalData })` ve `confirmOrder(name, { additionalData })`.

## Mevcut: `bankTransfer` (Havale / EFT)
`src/payments/bankTransfer.ts`. Referans kodu `SOA-…` üretir; işlem `pending` kalır, admin gelen ödemeyi
eşleştirip `succeeded` yapar.

## Sıradaki: iyzico
Önerilen akış — **Checkout Form (CF)** entegrasyonu, 3D Secure ve taksit iyzico tarafında:

1. `initiatePayment`: `POST /payment/iyzipos/checkoutform/initialize/auth` (iyzipay SDK: `checkoutFormInitialize.create`)
   - `price`/`paidPrice` = `cart.subtotal / 100`, `currency: 'TRY'`, `basketId: cart.id`,
     `callbackUrl: ${NEXT_PUBLIC_SERVER_URL}/api/payments/iyzico/callback`,
     `buyer` (ad, e-posta, TCKN/VKN için `identityNumber` — toptan müşteride VKN),
     `basketItems` sepet kalemlerinden.
   - Transaction oluştur: `{ paymentMethod: 'iyzico', iyzico: { token, conversationId }, status: 'pending', items, amount }`
   - Dön: `{ checkoutFormContent }` (iyzico'nun HTML/JS snippet'i) veya `paymentPageUrl`.
2. İstemci: `checkoutFormContent`'i sayfaya bas (iyzico iframe'i açar). Ödeme sonunda iyzico `callbackUrl`'e POST eder (`token`).
3. `endpoints: [{ path: '/callback', method: 'post' }]` → `checkoutForm.retrieve({ token })`, `paymentStatus === 'SUCCESS'` ise
   transaction'ı bul, `succeeded` yap; tarayıcıyı `/checkout/confirm-order?token=…` sayfasına yönlendir.
4. `confirmOrder`: token ile transaction'ı bul, durumu `succeeded` değilse hata; sipariş oluştur.

Gerekli env: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL` (sandbox: `https://sandbox-api.iyzipay.com`).
Test kartları iyzico sandbox dokümanında.

Not: iyzico komisyonu ve taksit tabloları için PayTR de karşılaştırılabilir; aynı adapter arayüzüne oturur.
