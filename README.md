# Sultan of Aura — e-ticaret sitesi

Trendyol'daki **SultanofAura** mağazası için bağımsız satış sitesi. Perakende + toptan (iki kademeli) fiyatlandırma, havale/EFT ile sipariş, Trendyol katalog aktarımı.

**Stack:** Next.js 16 · Payload CMS 3 (`@payloadcms/plugin-ecommerce`) · Postgres · Tailwind. Payload'ın resmi ecommerce şablonundan türetildi; Stripe çıkarıldı, TRY + toptan katmanı eklendi.

## Hızlı başlangıç

```bash
cp .env.example .env         # PAYLOAD_SECRET ve DATABASE_URL'i doldur
pnpm install
pnpm dev                     # http://localhost:3000  ·  admin: /admin
```

İlk açılışta `/admin` üzerinden admin kullanıcısını oluştur. Örnek katalog için admin panelindeki **Seed** butonu veya `pnpm seed`.

Test hesapları (şifre `password`): `musteri@example.com` (perakende), `toptan@example.com` (onaylı toptan), `basvuru@example.com` (onay bekliyor).

## İki kademeli fiyat nasıl çalışıyor

| Katman | Dosya |
|---|---|
| Ürün/varyantta `priceInTRY` (perakende) + `wholesalePriceInTRY` (toptan) + `minWholesaleQuantity` | `src/fields/wholesalePriceField.ts` |
| Toptan alanları **sadece** admin ve onaylı toptan müşterilere döner (field-level access) | `src/access/wholesale.ts` |
| Müşteri başvurusu: `users.wholesale` grubu (VKN, firma, vergi dairesi, durum) | `src/collections/Users/index.ts` |
| Müşteri yalnızca `none → pending` yapabilir; onay/red admin'de | `src/collections/Users/hooks/protectWholesaleStatus.ts` |
| Sepet toplamı onaylı toptan müşteri için toptan fiyattan hesaplanır (ödeme bu tutarı kullanır) | `src/collections/Carts/index.ts` |
| Vitrin: `TierPrice` bileşeni doğru katmanı gösterir; server sayfaları isteğin kullanıcısını Local API'ye geçirir | `src/components/TierPrice.tsx`, `src/utilities/getRequestUser.ts` |
| Başvuru sayfası | `/toptan-basvuru` |

Onay akışı: müşteri `/toptan-basvuru`'da VKN girer → admin **Users** listesinde "Onay bekliyor" filtresiyle görür, VKN'yi kontrol eder, durumu **Onaylı** yapar → müşteri bir sonraki sayfa yüklemesinde toptan fiyatları görür ve sepeti toptan hesaplanır.

## Ödeme

İki yöntem var, ikisi de aynı `PaymentAdapter` arayüzünü kullanıyor (ayrıntı: `docs/PAYMENTS.md`).

**Havale / EFT** (`src/payments/bankTransfer.ts`): sipariş `processing` durumunda açılır, işlem `pending` kalır; para gelince admin **Transactions**'ta `succeeded` yapar ve **Orders**'a kargo takip numarasını girer. Banka bilgileri `.env`'de (`BANK_*`).

**Kart — iyzico Checkout Form** (`src/payments/iyzico/`): 3D Secure ve taksit iyzico tarafında. Müşteri iyzico formunda öder → iyzico tarayıcıyı `/api/payments/iyzico/callback`'e yönlendirir → ödeme iyzico'ya tekrar sorulup yanıt imzası ve tutar doğrulanır → `/checkout/confirm-order` siparişi oluşturur. Anahtarlar `.env`'de (`IYZICO_*`); checkout'ta kart seçeneği yalnızca `NEXT_PUBLIC_IYZICO_ENABLED=true` iken görünür, dolayısıyla anahtar girilmeden havale akışı bozulmaz. Sandbox testi ve test kartları `docs/PAYMENTS.md`'de.

## Trendyol aktarımı

```bash
pnpm import:trendyol --dry-run                  # canlı API'den çek, sadece listele
pnpm import:trendyol                            # aktar / güncelle
pnpm import:trendyol --file=export.json --dry-run
```

`TRENDYOL_SUPPLIER_ID`, `TRENDYOL_API_KEY`, `TRENDYOL_API_SECRET` gerekli (satıcı panelinden). Aynı `productMainId`'yi paylaşan barkodlar varyant olur; toptan fiyat `TRENDYOL_WHOLESALE_RATIO` (vars. 0.6) ile perakendeden türetilir, sonra admin'de elle düzenlenir. Henüz canlı hesapla çalıştırılmadı.

## Komutlar

`pnpm dev` · `pnpm build` · `pnpm start` · `pnpm seed` · `pnpm import:trendyol` · `pnpm generate:types` · `pnpm lint`

## Yapılacaklar

- [x] iyzico kart ödemesi (sandbox; canlı anahtarlarla test edilecek)
- [ ] Gerçek ürün fotoğrafları + AI lifestyle varyantları (içerik pipeline'ı)
- [ ] Kalan İngilizce arayüz metinleri (hesap sayfaları, form hataları)
- [ ] Yasal sayfalar: mesafeli satış sözleşmesi, ön bilgilendirme, KVKK, iade
- [ ] E-posta bildirimleri (sipariş alındı, toptan onaylandı) — `@payloadcms/email-nodemailer` hazır
- [ ] Deploy (Vercel + Neon/Supabase Postgres, veya Hetzner)
