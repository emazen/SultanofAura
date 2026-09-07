# Ödeme adapter'ları

`@payloadcms/plugin-ecommerce` her ödeme yöntemini bir `PaymentAdapter` olarak alır:

- `initiatePayment({ data: { cart, currency, customerEmail, billingAddress, shippingAddress }, req, transactionsSlug })`
  → `transactions` koleksiyonunda `pending` kayıt oluşturur, istemciye gerekli veriyi döner.
  Plugin, çağrıdan önce sepetteki her ürünün fiyatını/stokunu doğrular; `cart.subtotal` bizim
  Carts hook'umuz tarafından (perakende/toptan) hesaplanmış tutardır — **adapter bu tutarı kullanır**.
- `confirmOrder({ data, req, ... })` → `orders` kaydı açar, sepeti `purchasedAt` ile kapatır.
- `endpoints: [...]` → `/api/payments/<adapter adı>/<path>` altına mount edilir.
- İstemci tarafı: `usePayments().initiatePayment(name, { additionalData })` ve `confirmOrder(name, { additionalData })`.

Adapter'lar `src/plugins/index.ts` (sunucu) ve `src/providers/index.tsx` (istemci) içinde kayıtlıdır.

## Havale / EFT — `bankTransfer`
`src/payments/bankTransfer.ts`. Referans kodu `SOA-…` üretir; işlem `pending` kalır, admin gelen ödemeyi
eşleştirip `succeeded` yapar. Banka bilgileri `BANK_*` env değişkenlerinden gelir.

## Kart — `iyzico` (Checkout Form)

`src/payments/iyzico/` — 3D Secure ve taksit tablosu iyzico tarafında.

| Dosya | İş |
|---|---|
| `api.ts` | IYZWSv2 (HMACSHA256) imzalama, HTTP, yanıt imzası doğrulama |
| `basket.ts` | Sepet kalemlerini iyzico basket'ine çevirir; toplamı `cart.subtotal`'a eşitler |
| `client.ts` | İstemci adapter'ı, `IYZICO` adı, `NEXT_PUBLIC_IYZICO_ENABLED` kontrolü |
| `index.ts` | Adapter: `initiatePayment`, `/callback` endpoint'i, `confirmOrder` |

`iyzipay` npm paketi **kullanılmıyor**: paket callback tabanlı CommonJS ve tek ihtiyacımız olan
imzalama ~20 satır. Auth şeması: `signature = HMAC_SHA256(randomKey + uriPath + body, secretKey)` (hex),
`Authorization: IYZWSv2 base64("apiKey:…&randomKey:…&signature:…")`, ayrıca `x-iyzi-rnd` başlığı.

### Akış

1. **`initiatePayment`** — `pending` transaction oluşturur (teslimat adresini `iyzico.shippingAddressSnapshot`
   içine yazar; müşteri iyzico'ya gidip döndüğünde istemcide state kalmıyor), sonra
   `POST /payment/iyzipos/checkoutform/initialize/auth/ecom`:
   - `price` / `paidPrice` = `cart.subtotal / 100`, `currency: TRY`, `basketId: cart.id`,
     `conversationId: SOA-<transaction id>`,
     `callbackUrl: ${NEXT_PUBLIC_SERVER_URL}/api/payments/iyzico/callback`
   - `buyer.identityNumber`: onaylı toptan müşteride VKN, aksi halde `IYZICO_DEFAULT_IDENTITY_NUMBER`
   - `basketItems`: satır fiyatları perakende/toptan çözülür, fark en büyük satıra eklenerek toplam
     `price` ile birebir eşitlenir (iyzico eşit değilse isteği reddeder)
   - Yanıtın `signature`'ı (`conversationId:token`) doğrulanır, `token` transaction'a yazılır.
   - İstemciye `{ token, checkoutFormContent, paymentPageUrl, amount }` döner.
2. **İstemci** — `IyzicoCheckoutForm` snippet'i `createContextualFragment` ile basar (`innerHTML`
   script'i çalıştırmaz). Guest müşterinin e-postası `sessionStorage`'a yazılır.
3. **`POST /api/payments/iyzico/callback`** — iyzico tarayıcıyı buraya POST eder (`token`).
   Callback gövdesine **güvenilmez**: `POST /payment/iyzipos/checkoutform/auth/ecom/detail` ile
   ödeme tekrar sorgulanır, yanıt imzası
   (`paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token`) doğrulanır,
   `paidPrice` transaction tutarıyla karşılaştırılır. Sonuç:
   - `SUCCESS` + `fraudStatus: 1` → transaction `succeeded`
   - `fraudStatus: 0` (inceleme) veya tutar uyuşmazlığı → `pending` + `iyzico.note`, sipariş açılmaz
   - aksi halde → `failed`, `/checkout?payment=failed`'a yönlendirir
   - başarılıysa `303` ile `/checkout/confirm-order?token=…`
4. **`confirmOrder`** — token ile transaction'ı bulur, gerekirse ödemeyi tekrar sorgular (callback
   düşerse akış yine tamamlanır), `processing` siparişi oluşturur, sepeti kapatır. Idempotent:
   transaction'a bağlı sipariş varsa onu döner, ikinci sipariş açmaz.

Imza doğrulaması bilinçli olarak fiyatın birkaç olası yazımını dener (`123.5`, `123.50`, `100.0`):
iyzico dokümanı "sondaki sıfırları at" diyor ama SDK'lar `100.0` imzalıyor, JSON.parse da biçimi
kaybediyor. Ham gövdedeki literal öncelikli.

### Env

```
IYZICO_API_KEY=
IYZICO_SECRET_KEY=
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com   # canlı: https://api.iyzipay.com
IYZICO_ENABLED_INSTALLMENTS=1                      # taksit açmak için: 1,2,3,6
IYZICO_DEFAULT_IDENTITY_NUMBER=11111111111         # perakendede TCKN toplamıyoruz
NEXT_PUBLIC_IYZICO_ENABLED=false                   # checkout'ta kartı göstermek için true
```

Sunucu adapter'ı her zaman kayıtlı (endpoint'ler ve admin alanları var olsun diye); **checkout'ta
kart seçeneği yalnızca `NEXT_PUBLIC_IYZICO_ENABLED=true` ise görünür**. Havale her durumda çalışır.

### Sandbox'ta test

1. https://sandbox-merchant.iyzipay.com/auth/register — hesap aç, *Ayarlar → Merchant Settings →
   API Keys*'ten `sandbox-…` anahtar çiftini al, `.env`'e yaz, `NEXT_PUBLIC_IYZICO_ENABLED=true` yap.
2. `NEXT_PUBLIC_SERVER_URL` iyzico'nun erişebileceği bir adres olmalı. Localhost'ta callback için
   tünel gerekir (`cloudflared tunnel --url http://localhost:3000` ya da ngrok) ve
   `NEXT_PUBLIC_SERVER_URL` tünel adresi olmalı — yoksa iyzico callback'i çağıramaz.
3. Test kartı: `5890040000000016` (Akbank), son kullanma tarihi ileri bir tarih, CVC rastgele,
   3D Secure OTP sandbox'ta sabit `123456`.
   Hata senaryoları: `4111111111111129` yetersiz bakiye, `4124111111111116` hatalı CVC.
4. Kontrol: admin → **Transactions**'ta `succeeded`, `iyzico.paymentId` dolu, **Orders**'ta
   `processing` sipariş ve doğru teslimat adresi.

Testler: `tests/int/iyzico.int.spec.ts` (imza doğrulama, sahte callback reddi, sepet toplamı).

Not: iyzico komisyonu ve taksit tabloları için PayTR de karşılaştırılabilir; aynı adapter arayüzüne oturur.
