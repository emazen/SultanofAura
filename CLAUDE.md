@AGENTS.md

# Sultan of Aura — project context for Claude Code

E-commerce site for the Trendyol shop **SultanofAura** (tütsü, bakhoor, palo santo, ahşap kuksa, rüzgar çanı, ahşap oyuncak). Owner is a small business; Emre builds and runs it. Turkish-language storefront, Turkish admin labels where we add fields.

## Stack
Next.js 16 · Payload CMS 3.88 with `@payloadcms/plugin-ecommerce` (beta) · Postgres · Tailwind 4 · pnpm. Started from Payload's official `ecommerce` template; Stripe removed. `pnpm dev` → http://localhost:3000, admin at `/admin`. Postgres via `DATABASE_URL` in `.env` (see `.env.example`). `pnpm generate:types` after any collection change; `pnpm exec tsc --noEmit` before committing.

## Core business rule: two-tier pricing (perakende / toptan)
Prices are integers in **kuruş**. Single currency TRY (`src/lib/currency.ts`).

- Products & variants: `priceInTRY` (retail, plugin field) + `wholesalePriceInTRY` + `minWholesaleQuantity` (`src/fields/wholesalePriceField.ts`). Wholesale fields have **field-level read access** (`src/access/wholesale.ts`) → API returns them only to admins and users with `wholesale.status === 'approved'`. Never bypass this with `overrideAccess: true` in anything user-facing.
- `users.wholesale` group: `status` none|pending|approved|rejected, `companyName`, `taxNumber` (VKN 10 / TCKN 11 digits, validated), `taxOffice`, `phone`, `appliedAt`, `reviewedAt`, `reviewNote` (admin-only). Hook `protectWholesaleStatus` (`src/collections/Users/hooks/`) lets customers only go none→pending; admins approve in `/admin`.
- Carts override (`src/collections/Carts/index.ts`): after the plugin computes `subtotal`, recompute from wholesale prices when the cart's customer is approved; sets `pricingTier`; pins `cart.customer` to `req.user` for non-admins. Payment initiation trusts `cart.subtotal`, so this is what gets charged.
- Server components must pass the request user to the Local API: `const user = await getRequestUser()` then `payload.find({ ..., overrideAccess: false, user })` (`src/utilities/getRequestUser.ts`). Otherwise SSR never sees wholesale prices.
- Storefront: `<TierPrice item={productOrVariant} quantity={n} />` (`src/components/TierPrice.tsx`) renders the right tier; `usePrice`/`resolvePrice` in `src/hooks/usePricing.ts`. Application page `/toptan-basvuru` (`src/components/forms/WholesaleApplicationForm`).

## Payments
`src/payments/bankTransfer.ts` — havale/EFT adapter (`PaymentAdapter` from the plugin). Bank details from env `BANK_NAME`, `BANK_ACCOUNT_HOLDER`, `BANK_IBAN`. Order opens `processing`, transaction stays `pending` until the owner marks it `succeeded` in admin. Card payments: implement an iyzico adapter next — flow written up in `docs/PAYMENTS.md`. Register adapters in `src/plugins/index.ts` (server) and `src/providers/index.tsx` (client), checkout UI in `src/components/checkout/CheckoutPage.tsx` + `src/components/forms/CheckoutForm`.

## Orders
`ordersCollectionOverride` in `src/plugins/index.ts` adds `shipping` group (carrier select, trackingNumber, shippedAt). Shipping addresses restricted to `TR`.

## Data
- Dev seed: admin **Seed** button or `pnpm seed` (`src/endpoints/seed/`, catalogue in `catalogue.ts`). Test users, password `password`: `musteri@example.com` retail · `toptan@example.com` approved wholesale · `basvuru@example.com` pending.
- Trendyol import: `pnpm import:trendyol [--dry-run] [--file=export.json]` (`scripts/import-trendyol.ts`). Needs `TRENDYOL_SUPPLIER_ID` (1190557), `TRENDYOL_API_KEY`, `TRENDYOL_API_SECRET` from the owner's Satıcı Paneli → Hesabım → Entegrasyon Bilgileri. Groups barcodes by `productMainId` into variants; wholesale price defaults to 60% of retail (`TRENDYOL_WHOLESALE_RATIO`). **Not yet run against the live account.** Products/variants carry `trendyolProductMainId` / `trendyolBarcode` for re-sync.

## Conventions
- New admin field labels in Turkish; code, identifiers and comments in English.
- Don't add currencies; don't reintroduce Stripe.
- Anything that touches price or wholesale visibility: add a quick curl check as anonymous / retail / approved user before calling it done (see README "İki kademeli fiyat").

## Roadmap (in order)
1. **Repo hygiene**: confirm `pnpm build` passes; run the seed; click through as the three test users.
2. **iyzico adapter** (`docs/PAYMENTS.md`) + checkout UI choice between Havale and Kart. Sandbox first.
3. **Trendyol import** against the live account once the owner shares API credentials; review the mapping (categories, variant axis) and wholesale prices in admin.
4. **Content pipeline** (`scripts/` ): one real photo per product in → 3–5 lifestyle images via an image-editing model (product fidelity matters — do not generate the product itself) + SEO title/description/body in Turkish → written into Payload. Video only for a selected top 20–30.
5. **SEO**: category page copy, blog (Pages collection is layout-builder enabled), schema.org Product JSON-LD already on product pages (price emitted in lira), sitemap/robots, Search Console.
6. **Legal pages**: mesafeli satış sözleşmesi, ön bilgilendirme formu, KVKK aydınlatma, iade & teslimat; checkout checkbox referencing them; ETBİS registration is the owner's task.
7. **Emails**: order received (with havale details), wholesale approved/rejected, shipped with tracking — `@payloadcms/email-nodemailer` is a dependency; Resend works fine.
8. **Remaining i18n**: account pages, form validation messages, order pages still English.
9. **Deploy**: Vercel + Neon Postgres (or Hetzner + Coolify). Set all env vars; `PAYLOAD_SECRET` must be regenerated; media storage needs S3/R2 (`@payloadcms/storage-s3`) on Vercel since the filesystem is ephemeral.
10. **Owner training**: 30-min walkthrough of admin — approving toptan applications, marking havale received, adding tracking numbers, editing products.
