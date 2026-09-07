import type { Page } from '@/payload-types'

/**
 * Fallback home page shown before the database has been seeded / a Home page
 * has been created in the admin, so a fresh deploy never 404s on "/".
 */
export const homeStaticData = (): Partial<Page> => ({
  slug: 'home',
  _status: 'published',
  title: 'Ana Sayfa',
  hero: {
    type: 'lowImpact',
    links: [
      { link: { type: 'custom', appearance: 'default', label: 'Ürünleri keşfet', url: '/shop' } },
    ],
    richText: {
      root: {
        type: 'root',
        children: [
          {
            type: 'heading',
            tag: 'h1',
            children: [
              { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text: 'Sultan of Aura', version: 1 },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Site hazırlanıyor. Yönetim panelinden Ana Sayfa içeriğini oluşturun.',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            textFormat: 0,
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
    } as any,
  },
  layout: [],
})
