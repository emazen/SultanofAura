import { AuthProvider } from '@/providers/Auth'
import { EcommerceProvider } from '@payloadcms/plugin-ecommerce/client/react'
import { bankTransferAdapterClient } from '@/payments/bankTransfer'
import { isIyzicoEnabled, iyzicoAdapterClient } from '@/payments/iyzico/client'
import { TRY } from '@/lib/currency'
import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { SonnerProvider } from '@/providers/Sonner'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const paymentMethods = [
    bankTransferAdapterClient(),
    ...(isIyzicoEnabled() ? [iyzicoAdapterClient()] : []),
  ]

  return (
    <ThemeProvider>
      <AuthProvider>
        <HeaderThemeProvider>
          <SonnerProvider />
          <EcommerceProvider
            enableVariants={true}
            api={{
              cartsFetchQuery: {
                depth: 2,
                populate: {
                  products: {
                    slug: true,
                    title: true,
                    gallery: true,
                    inventory: true,
                    priceInTRY: true,
                    wholesalePriceInTRY: true,
                    minWholesaleQuantity: true,
                  },
                  variants: {
                    title: true,
                    inventory: true,
                    priceInTRY: true,
                    wholesalePriceInTRY: true,
                    options: true,
                  },
                },
              },
            }}
            currenciesConfig={{ defaultCurrency: TRY.code, supportedCurrencies: [TRY] }}
            paymentMethods={paymentMethods}
          >
            {children}
          </EcommerceProvider>
        </HeaderThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
