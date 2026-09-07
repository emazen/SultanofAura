import type { FieldAccess } from 'payload'

import type { User } from '@/payload-types'

import { checkRole } from '@/access/utilities'

/**
 * True when the user has been approved for wholesale (toptan) pricing by an admin.
 * Approval is a manual step in the admin panel after the customer submits their
 * tax number (VKN) and company details.
 */
export const isWholesaleApproved = (user?: User | null): boolean =>
  Boolean(user && user.wholesale?.status === 'approved')

/**
 * Field-level access: wholesale prices are only ever returned to admins and
 * approved wholesale customers. Everyone else gets the field stripped from
 * API responses, so the retail storefront can never leak toptan prices.
 */
export const wholesaleOrAdminFieldAccess: FieldAccess = ({ req: { user } }) => {
  if (!user) return false
  if (checkRole(['admin'], user)) return true
  return isWholesaleApproved(user)
}
