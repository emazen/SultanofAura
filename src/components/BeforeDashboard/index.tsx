import { Banner } from '@payloadcms/ui'
import React from 'react'

import { SeedButton } from './SeedButton'
import './index.scss'

const baseClass = 'before-dashboard'

/**
 * Owner-facing dashboard notes (Turkish). Shown above the collections list.
 */
export const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Sultan of Aura yönetim paneline hoş geldiniz</h4>
      </Banner>
      Günlük işler:
      <ul className={`${baseClass}__instructions`}>
        <li>
          <strong>Toptan başvuruları:</strong> Users → filtre &quot;Toptan durumu: Onay bekliyor&quot;.
          Vergi numarasını ve firma unvanını kontrol edin, durumu <em>Onaylı</em> yapın. Müşteri bir
          sonraki girişinde toptan fiyatları görür.
        </li>
        <li>
          <strong>Havale/EFT ödemeleri:</strong> Transactions → durumu <em>pending</em> olanlar.
          Para hesaba geçince referans kodunu eşleştirip durumu <em>succeeded</em> yapın, ardından
          ilgili Order&apos;a kargo takip numarasını girin.
        </li>
        <li>
          <strong>Ürünler:</strong> Her ürünün perakende fiyatı zorunlu, toptan fiyatı isteğe bağlı.
          Toptan fiyat boşsa toptan müşteriler perakende fiyatı görür.
        </li>
        <li>
          <SeedButton />
          {' — yalnızca geliştirme ortamında örnek ürünler yükler.'}
        </li>
      </ul>
    </div>
  )
}
