import type { CollectionBeforeChangeHook } from 'payload'

import type { User } from '@/payload-types'

import { checkRole } from '@/access/utilities'

/**
 * Customers may apply for wholesale pricing (status -> 'pending') but only an
 * admin can approve or reject. This hook enforces that on the server regardless
 * of what the client sends.
 */
export const protectWholesaleStatus: CollectionBeforeChangeHook<User> = ({
  data,
  originalDoc,
  req,
}) => {
  const isAdmin = checkRole(['admin'], req.user)
  if (isAdmin || !data.wholesale) return data

  const previousStatus = originalDoc?.wholesale?.status ?? 'none'
  const requestedStatus = data.wholesale.status

  if (requestedStatus && requestedStatus !== previousStatus) {
    // Only transition a non-admin may make: none/rejected -> pending
    const allowed = requestedStatus === 'pending' && previousStatus !== 'approved'
    data.wholesale.status = allowed ? 'pending' : previousStatus
    if (allowed) data.wholesale.appliedAt = new Date().toISOString()
  }

  // Non-admins never touch review metadata
  if (originalDoc?.wholesale) {
    data.wholesale.reviewedAt = originalDoc.wholesale.reviewedAt
    data.wholesale.reviewNote = originalDoc.wholesale.reviewNote
  }

  return data
}
