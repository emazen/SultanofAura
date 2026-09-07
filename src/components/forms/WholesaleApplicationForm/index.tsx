'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

type FormData = {
  companyName: string
  taxNumber: string
  taxOffice: string
  phone: string
}

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  pending: {
    title: 'Başvurunuz inceleniyor',
    body: 'Vergi bilgilerinizi kontrol ediyoruz. Genellikle 1 iş günü içinde sonuçlanır; onaylandığında toptan fiyatlar sitede otomatik görünür.',
  },
  approved: {
    title: 'Toptan hesabınız onaylı',
    body: 'Ürün sayfalarında toptan fiyatları görüyorsunuz. Sepetiniz toptan fiyatlarla hesaplanır.',
  },
  rejected: {
    title: 'Başvurunuz onaylanmadı',
    body: 'Bilgilerinizi güncelleyip yeniden başvurabilir veya bizimle iletişime geçebilirsiniz.',
  },
}

export const WholesaleApplicationForm: React.FC = () => {
  const { user, setUser } = useAuth()
  const router = useRouter()

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<FormData>()

  useEffect(() => {
    if (user === null) {
      router.push(
        `/login?warning=${encodeURIComponent('Toptan başvurusu için giriş yapın veya hesap oluşturun.')}&redirect=${encodeURIComponent('/toptan-basvuru')}`,
      )
    }
    if (user) {
      reset({
        companyName: user.wholesale?.companyName ?? '',
        taxNumber: user.wholesale?.taxNumber ?? '',
        taxOffice: user.wholesale?.taxOffice ?? '',
        phone: user.wholesale?.phone ?? '',
      })
    }
  }, [user, router, reset])

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (!user) return
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/${user.id}`, {
        body: JSON.stringify({
          wholesale: {
            ...data,
            taxNumber: data.taxNumber.replace(/\s+/g, ''),
            status: 'pending',
          },
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      })

      if (response.ok) {
        const json = await response.json()
        setUser(json.doc)
        toast.success('Başvurunuz alındı.')
      } else {
        const json = await response.json().catch(() => null)
        toast.error(json?.errors?.[0]?.message || 'Başvuru gönderilemedi.')
      }
    },
    [user, setUser],
  )

  if (!user) return null

  const status = user.wholesale?.status ?? 'none'
  const statusCopy = STATUS_COPY[status]

  return (
    <div className="max-w-xl flex flex-col gap-8">
      {statusCopy && (
        <div className="rounded-lg border bg-accent/40 p-6">
          <h2 className="text-xl font-medium mb-2">{statusCopy.title}</h2>
          <p className="text-primary/70">{statusCopy.body}</p>
          {status === 'approved' && (
            <Button asChild className="mt-4" variant="default">
              <Link href="/shop">Toptan fiyatlarla alışverişe başla</Link>
            </Button>
          )}
        </div>
      )}

      {status !== 'approved' && (
        <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="prose dark:prose-invert">
            <p>
              Toptan fiyatları görmek için firma bilgilerinizi girin. Bilgiler kontrol edildikten
              sonra hesabınız toptan müşteri olarak işaretlenir ve faturalarınız bu bilgilerle
              kesilir.
            </p>
          </div>

          <FormItem>
            <Label htmlFor="companyName">Firma unvanı</Label>
            <Input
              id="companyName"
              {...register('companyName', { required: 'Firma unvanı gerekli.' })}
            />
            {errors.companyName && <FormError message={errors.companyName.message} />}
          </FormItem>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FormItem>
              <Label htmlFor="taxNumber">Vergi numarası (VKN / TCKN)</Label>
              <Input
                id="taxNumber"
                inputMode="numeric"
                {...register('taxNumber', {
                  required: 'Vergi numarası gerekli.',
                  validate: (v) =>
                    /^\d{10,11}$/.test(v.replace(/\s+/g, '')) ||
                    '10 haneli VKN veya 11 haneli TCKN girin.',
                })}
              />
              {errors.taxNumber && <FormError message={errors.taxNumber.message} />}
            </FormItem>

            <FormItem>
              <Label htmlFor="taxOffice">Vergi dairesi</Label>
              <Input id="taxOffice" {...register('taxOffice', { required: 'Vergi dairesi gerekli.' })} />
              {errors.taxOffice && <FormError message={errors.taxOffice.message} />}
            </FormItem>
          </div>

          <FormItem>
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" type="tel" {...register('phone', { required: 'Telefon gerekli.' })} />
            {errors.phone && <FormError message={errors.phone.message} />}
          </FormItem>

          <Button disabled={isSubmitting} type="submit" variant="default" className="self-start">
            {isSubmitting
              ? 'Gönderiliyor...'
              : status === 'pending'
                ? 'Bilgileri güncelle'
                : 'Toptan başvurusu gönder'}
          </Button>
        </form>
      )}
    </div>
  )
}
