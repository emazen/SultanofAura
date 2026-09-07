/** CLI seed: `pnpm seed` (same as the admin "Seed" button). */
import 'dotenv/config'
import { createLocalReq, getPayload } from 'payload'

import config from '../src/payload.config'
import { seed } from '../src/endpoints/seed'

const payload = await getPayload({ config })
const admin = (await payload.find({ collection: 'users', where: { roles: { contains: 'admin' } }, limit: 1 })).docs[0]
if (!admin) throw new Error('Create the first admin user in /admin before seeding.')
const req = await createLocalReq({ user: admin }, payload)
await seed({ payload, req })
process.exit(0)
