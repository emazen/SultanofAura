import type { Media, Product } from '@/payload-types'
import { RequiredDataFromCollectionSlug } from 'payload'

type Args = {
  metaImage: Media
  contentImage: Media
  featured: Product[]
}

const text = (t: string) => ({
  type: 'text',
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text: t,
  version: 1,
})

const paragraph = (t: string) => ({
  type: 'paragraph',
  children: [text(t)],
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  version: 1,
})

const heading = (t: string, tag: 'h1' | 'h2') => ({
  type: 'heading',
  children: [text(t)],
  direction: 'ltr',
  format: '',
  indent: 0,
  tag,
  version: 1,
})

const root = (children: unknown[]) => ({
  root: {
    type: 'root',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})

export const homePageData: (args: Args) => RequiredDataFromCollectionSlug<'pages'> = ({
  metaImage,
  contentImage,
  featured,
}) => {
  return {
    slug: 'home',
    _status: 'published',
    title: 'Ana Sayfa',
    hero: {
      type: 'lowImpact',
      links: [
        {
          link: { type: 'custom', appearance: 'default', label: 'Ürünleri keşfet', url: '/shop' },
        },
        {
          link: {
            type: 'custom',
            appearance: 'outline',
            label: 'Toptan satış',
            url: '/toptan-basvuru',
          },
        },
      ],
      richText: root([
        heading('Sultan of Aura', 'h1'),
        paragraph(
          'Tütsü, bakhoor, palo santo, el yapımı ahşap kuksa ve dekor ürünleri. Evinize ve mağazanıza huzur getiren seçkiler; perakende ve toptan.',
        ),
      ]) as any,
    },
    layout: [
      {
        blockType: 'threeItemGrid',
        products: featured.slice(0, 3).map((p) => p.id),
      },
      {
        blockType: 'content',
        columns: [
          {
            size: 'half',
            richText: root([
              heading('Mağazanız için toptan', 'h2'),
              paragraph(
                'Hediyelik, dekor ve yaşam mağazaları için toptan fiyat listesi sunuyoruz. Vergi numaranızla başvurun; onaydan sonra sitedeki tüm fiyatlar toptan olarak görünür ve faturanız firma bilgilerinize kesilir.',
              ),
            ]) as any,
            enableLink: true,
            link: {
              type: 'custom',
              appearance: 'default',
              label: 'Toptan başvurusu yap',
              url: '/toptan-basvuru',
            },
          },
          {
            size: 'half',
            richText: root([
              heading('Trendyol’dan tanıyor musunuz?', 'h2'),
              paragraph(
                'Trendyol mağazamızdaki tüm ürünler burada da satışta. Sitemizden alışverişte kargo ve destek doğrudan bizden; sorularınız için iletişim sayfasını kullanabilirsiniz.',
              ),
            ]) as any,
            enableLink: true,
            link: { type: 'custom', appearance: 'outline', label: 'İletişim', url: '/contact' },
          },
        ],
      },
      {
        blockType: 'mediaBlock',
        media: contentImage.id,
      },
    ] as any,
    meta: {
      description:
        'Sultan of Aura: tütsü, bakhoor, palo santo, ahşap kuksa ve dekor ürünleri. Perakende ve toptan satış.',
      image: metaImage.id,
      title: 'Sultan of Aura | Tütsü, Palo Santo, Kuksa & Dekor',
    },
  }
}
