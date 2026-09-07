import type { User } from '@/payload-types'

import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

/**
 * Resolve the logged-in user for a server component request so that Local API
 * calls made with `overrideAccess: false` apply the right field-level access —
 * in particular, wholesale prices are only returned for approved customers.
 */
export const getRequestUser = async (): Promise<User | null> => {
  try {
    const payload = await getPayload({ config: configPromise })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })
    return (user as User) || null
  } catch {
    return null
  }
}
