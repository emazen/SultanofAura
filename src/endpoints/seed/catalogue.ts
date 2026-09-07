/**
 * Development seed catalogue modelled on the SultanofAura Trendyol shop
 * (tütsü, bakhoor, palo santo, kuksa, rüzgar çanı, ahşap oyuncak).
 *
 * Prices are in kuruş. Wholesale is roughly 55–65% of retail, which is typical
 * for this category. Real data will come from the Trendyol import script.
 */

export type SeedProduct = {
  slug: string
  title: string
  category: string
  retail: number
  wholesale: number
  minWholesaleQuantity?: number
  inventory: number
  color: string
  short: string
  description: string
  seoTitle: string
  seoDescription: string
  /** For products with a single variant axis (e.g. scent). */
  variants?: { type: 'scent'; options: { label: string; value: string }[] }
}

export const seedCategories = [
  { slug: 'tutsu', title: 'Tütsü & Bakhoor' },
  { slug: 'palo-santo', title: 'Palo Santo & Arınma' },
  { slug: 'kuksa', title: 'Ahşap Kuksa' },
  { slug: 'dekor', title: 'Dekor & Hediyelik' },
]

export const seedProducts: SeedProduct[] = [
  {
    slug: 'sreevani-bakhoor-al-arab-cubuk-tutsu-100lu',
    title: 'Sreevani Bakhoor Al Arab Çubuk Tütsü (100\'lü)',
    category: 'tutsu',
    retail: 18900,
    wholesale: 11500,
    minWholesaleQuantity: 6,
    inventory: 240,
    color: '#6b3a2e',
    short: 'Yoğun oud ve amber notalı Arap bakhoor kokusu, 100 adet çubuk.',
    description:
      'Sreevani Bakhoor Al Arab, geleneksel Arap bakhoor kokusunu çubuk tütsü pratikliğiyle bir araya getirir. Oud, amber ve hafif gül notaları; yaklaşık 35-40 dakika yanma süresi. Evde, mağazada veya meditasyon alanında ağır ve sıcak bir atmosfer için idealdir. Her pakette 100 çubuk bulunur.',
    seoTitle: 'Bakhoor Al Arab Çubuk Tütsü 100\'lü | Sultan of Aura',
    seoDescription:
      'Sreevani Bakhoor Al Arab 100\'lü çubuk tütsü. Oud ve amber notalı Arap bakhoor kokusu. Toptan fiyat için vergi numaranızla başvurun.',
  },
  {
    slug: 'hem-cubuk-tutsu-20li',
    title: 'HEM Çubuk Tütsü (20\'li)',
    category: 'tutsu',
    retail: 4900,
    wholesale: 2750,
    minWholesaleQuantity: 12,
    inventory: 600,
    color: '#8a5a3c',
    short: 'Klasik Hint çubuk tütsü, 20 adet. Farklı kokularda.',
    description:
      'HEM, dünyanın en çok satan Hint tütsü markalarından biridir. Her kutuda 20 adet, yaklaşık 30 dakika yanan çubuk bulunur. Kokuyu aşağıdan seçebilirsiniz.',
    seoTitle: 'HEM Çubuk Tütsü 20\'li | Sultan of Aura',
    seoDescription:
      'HEM Hint çubuk tütsü 20\'li kutu. Lavanta, sandal ağacı, nag champa ve daha fazla koku seçeneği. Perakende ve toptan.',
    variants: {
      type: 'scent',
      options: [
        { label: 'Lavanta', value: 'lavanta' },
        { label: 'Sandal Ağacı', value: 'sandal' },
        { label: 'Nag Champa', value: 'nag-champa' },
        { label: 'Beyaz Adaçayı', value: 'beyaz-adacayi' },
      ],
    },
  },
  {
    slug: 'palo-santo-arinma-ve-enerji-dengeleme-seti',
    title: 'Palo Santo & Hızlı Yanan Kömürlü Arınma ve Enerji Dengeleme Seti',
    category: 'palo-santo',
    retail: 34900,
    wholesale: 21000,
    minWholesaleQuantity: 4,
    inventory: 80,
    color: '#b89b6a',
    short: 'Peru palo santo çubukları, hızlı yanan kömür ve seramik tabak.',
    description:
      'Set içeriği: 5 adet doğal Peru palo santo çubuğu, 10 adet hızlı yanan tütsü kömürü, 1 adet seramik yakma tabağı ve kullanım kartı. Ortam enerjisini dengelemek ve odayı arındırmak için başlangıç setidir.',
    seoTitle: 'Palo Santo Arınma Seti | Sultan of Aura',
    seoDescription:
      'Palo santo, hızlı yanan kömür ve seramik tabaktan oluşan arınma ve enerji dengeleme seti. Hediye kutusunda.',
  },
  {
    slug: 'palo-santo-cubuk-5li',
    title: 'Doğal Palo Santo Çubuk (5\'li)',
    category: 'palo-santo',
    retail: 14900,
    wholesale: 8500,
    minWholesaleQuantity: 10,
    inventory: 300,
    color: '#c9b083',
    short: 'Peru kaynaklı, sürdürülebilir hasat palo santo, 5 çubuk.',
    description:
      'Bursera graveolens ağacından, doğal olarak düşmüş dallardan elde edilen palo santo. Tatlı, odunsu ve hafif narenciye kokusu. Her çubuk 10 cm civarındadır ve onlarca kez kullanılabilir.',
    seoTitle: 'Palo Santo Çubuk 5\'li | Sultan of Aura',
    seoDescription: 'Sürdürülebilir hasat Peru palo santo çubukları, 5\'li paket.',
  },
  {
    slug: 'ahsap-kuksa-bardak',
    title: 'Ahşap Kuksa Bardak',
    category: 'kuksa',
    retail: 39900,
    wholesale: 24500,
    minWholesaleQuantity: 4,
    inventory: 60,
    color: '#9c6b3f',
    short: 'El yapımı ahşap kuksa kupa, yaklaşık 200 ml.',
    description:
      'İskandinav geleneğinden ilham alan, tek parça ahşaptan el yapımı kuksa bardak. Yaklaşık 200 ml kapasite, doğal yağ ile bitirilmiş. Kamp, kahve ve hediye için. Elde yıkanmalı, bulaşık makinesine uygun değildir.',
    seoTitle: 'Ahşap Kuksa Bardak | Sultan of Aura',
    seoDescription: 'El yapımı ahşap kuksa kupa 200 ml. Kamp ve kahve için doğal ahşap bardak.',
  },
  {
    slug: 'bambu-leylek-ruzgar-cani',
    title: 'Bambu Leylek Rüzgar Çanı',
    category: 'dekor',
    retail: 24900,
    wholesale: 14900,
    minWholesaleQuantity: 6,
    inventory: 120,
    color: '#7d8c5a',
    short: 'Bambu borulu, ahşap leylek figürlü rüzgar çanı.',
    description:
      'Doğal bambu borular ve el boyaması ahşap leylek figürüyle balkon, bahçe ve pencere önü için rüzgar çanı. Yumuşak, derin bambu tınısı. Yaklaşık 60 cm uzunluk.',
    seoTitle: 'Bambu Leylek Rüzgar Çanı | Sultan of Aura',
    seoDescription: 'Bambu borulu, ahşap leylek figürlü rüzgar çanı. Balkon ve bahçe dekoru.',
  },
  {
    slug: 'ahsap-pinokyo-kukla-25-cm',
    title: 'Ahşap Pinokyo Kukla 25 cm – İpli Asmalı Dekoratif Oyuncak',
    category: 'dekor',
    retail: 29900,
    wholesale: 17500,
    minWholesaleQuantity: 6,
    inventory: 90,
    color: '#c0392b',
    short: 'İpli, asmalı ahşap kukla; dekor ve hediyelik.',
    description:
      'Klasik tarzda, el boyaması ahşap ipli kukla. 25 cm boy, hareketli kol ve bacaklar, asma ipi dahil. Çocuk odası dekoru ve nostaljik hediye için.',
    seoTitle: 'Ahşap Pinokyo Kukla 25 cm | Sultan of Aura',
    seoDescription: 'El boyaması ahşap ipli kukla 25 cm. Dekoratif oyuncak ve hediyelik.',
  },
]
