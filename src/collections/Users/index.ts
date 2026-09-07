import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { publicAccess } from '@/access/publicAccess'
import { adminOrSelf } from '@/access/adminOrSelf'
import { checkRole } from '@/access/utilities'

import { ensureFirstUserIsAdmin } from './hooks/ensureFirstUserIsAdmin'
import { protectWholesaleStatus } from './hooks/protectWholesaleStatus'

/** Turkish VKN is 10 digits; a TCKN (sole traders) is 11 digits. */
const validateTaxNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') return true
  if (typeof value !== 'string' || !/^\d{10,11}$/.test(value.trim())) {
    return 'Vergi numarası 10 haneli (VKN) veya 11 haneli (TCKN) olmalıdır.'
  }
  return true
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => checkRole(['admin'], user),
    create: publicAccess,
    delete: adminOnly,
    read: adminOrSelf,
    unlock: adminOnly,
    update: adminOrSelf,
  },
  admin: {
    group: 'Users',
    defaultColumns: ['name', 'email', 'roles', 'wholesale.status', 'wholesale.companyName'],
    useAsTitle: 'name',
  },
  auth: {
    tokenExpiration: 1209600,
  },
  hooks: {
    beforeChange: [protectWholesaleStatus],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'wholesale',
      type: 'group',
      label: 'Toptan (Wholesale)',
      admin: {
        description:
          'Toptan fiyatları görmek isteyen müşteriler vergi numarasıyla başvurur; onay admin tarafından verilir.',
      },
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'none',
          options: [
            { label: 'Başvuru yok', value: 'none' },
            { label: 'Onay bekliyor', value: 'pending' },
            { label: 'Onaylı', value: 'approved' },
            { label: 'Reddedildi', value: 'rejected' },
          ],
          admin: { position: 'sidebar' },
        },
        {
          type: 'row',
          fields: [
            { name: 'companyName', type: 'text', label: 'Firma unvanı' },
            {
              name: 'taxNumber',
              type: 'text',
              label: 'Vergi numarası (VKN / TCKN)',
              validate: validateTaxNumber,
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'taxOffice', type: 'text', label: 'Vergi dairesi' },
            { name: 'phone', type: 'text', label: 'Telefon' },
          ],
        },
        {
          name: 'appliedAt',
          type: 'date',
          label: 'Başvuru tarihi',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'reviewedAt',
          type: 'date',
          label: 'İnceleme tarihi',
          access: { update: adminOnlyFieldAccess },
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'reviewNote',
          type: 'textarea',
          label: 'İnceleme notu (müşteri görmez)',
          access: { read: adminOnlyFieldAccess, update: adminOnlyFieldAccess },
        },
      ],
    },
    {
      name: 'roles',
      type: 'select',
      access: {
        create: adminOnlyFieldAccess,
        read: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      defaultValue: ['customer'],
      hasMany: true,
      hooks: {
        beforeChange: [ensureFirstUserIsAdmin],
      },
      options: [
        {
          label: 'admin',
          value: 'admin',
        },
        {
          label: 'customer',
          value: 'customer',
        },
      ],
    },
    {
      name: 'orders',
      type: 'join',
      collection: 'orders',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'cart',
      type: 'join',
      collection: 'carts',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'addresses',
      type: 'join',
      collection: 'addresses',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id'],
      },
    },
  ],
}
