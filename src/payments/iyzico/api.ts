import crypto from 'crypto'

/**
 * Minimal iyzico client.
 *
 * We talk to the REST API directly instead of pulling in the `iyzipay` npm package:
 * the SDK is callback-based CommonJS and the only thing we actually need from it is
 * the HMACSHA256 (IYZWSv2) authorization header, which is ~20 lines.
 *
 * Auth, per https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth:
 *
 *   signature   = HMAC_SHA256(randomKey + uriPath + requestBody, secretKey)  (hex)
 *   authString  = "apiKey:<key>&randomKey:<rnd>&signature:<hex>"
 *   Authorization: IYZWSv2 <base64(authString)>
 *   x-iyzi-rnd: <randomKey>
 */

export const CF_INITIALIZE_PATH = '/payment/iyzipos/checkoutform/initialize/auth/ecom'
export const CF_RETRIEVE_PATH = '/payment/iyzipos/checkoutform/auth/ecom/detail'

export type IyzicoConfig = {
  apiKey: string
  baseURL: string
  secretKey: string
}

export type IyzicoResponse<T = Record<string, unknown>> = {
  data: T & {
    conversationId?: string
    errorCode?: string
    errorMessage?: string
    signature?: string
    status?: string
  }
  /** Raw response body, kept so signature checks can use the literal number formatting. */
  raw: string
}

/**
 * Reads the iyzico credentials from the environment. Sandbox and production differ
 * only by `IYZICO_BASE_URL` and the key pair.
 */
export const getIyzicoConfig = (): IyzicoConfig => {
  const apiKey = process.env.IYZICO_API_KEY
  const secretKey = process.env.IYZICO_SECRET_KEY
  const baseURL = process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'

  if (!apiKey || !secretKey) {
    throw new Error(
      'iyzico yapılandırılmamış: IYZICO_API_KEY ve IYZICO_SECRET_KEY ortam değişkenlerini ayarlayın.',
    )
  }

  return { apiKey, baseURL: baseURL.replace(/\/$/, ''), secretKey }
}

export const hmacHex = (payload: string, secretKey: string): string =>
  crypto.createHmac('sha256', secretKey).update(payload, 'utf8').digest('hex')

const buildAuthorizationHeader = ({
  body,
  config,
  randomKey,
  uriPath,
}: {
  body: string
  config: IyzicoConfig
  randomKey: string
  uriPath: string
}): string => {
  const signature = hmacHex(`${randomKey}${uriPath}${body}`, config.secretKey)
  const authString = `apiKey:${config.apiKey}&randomKey:${randomKey}&signature:${signature}`

  return `IYZWSv2 ${Buffer.from(authString, 'utf8').toString('base64')}`
}

const makeRandomKey = (): string => `${Date.now()}${crypto.randomInt(100000000, 999999999)}`

/**
 * POST a signed request to iyzico. Network and parse failures throw; an
 * `status: 'failure'` payload is returned as-is for the caller to interpret.
 */
export const iyzicoRequest = async <T = Record<string, unknown>>({
  body,
  config,
  uriPath,
}: {
  body: Record<string, unknown>
  config: IyzicoConfig
  uriPath: string
}): Promise<IyzicoResponse<T>> => {
  const serialized = JSON.stringify(body)
  const randomKey = makeRandomKey()

  const response = await fetch(`${config.baseURL}${uriPath}`, {
    body: serialized,
    headers: {
      Authorization: buildAuthorizationHeader({ body: serialized, config, randomKey, uriPath }),
      'Content-Type': 'application/json',
      'x-iyzi-rnd': randomKey,
    },
    method: 'POST',
  })

  const raw = await response.text()

  let data: IyzicoResponse<T>['data']
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`iyzico yanıtı okunamadı (HTTP ${response.status}).`)
  }

  return { data, raw }
}

/** Amount in kuruş -> the decimal string iyzico expects, e.g. 12345 -> "123.45". */
export const formatPrice = (kurus: number): string => (kurus / 100).toFixed(2)

/** Decimal string/number from iyzico -> kuruş, rounded to the nearest integer. */
export const parsePriceToKurus = (price: unknown): null | number => {
  const value = typeof price === 'string' ? Number(price) : price
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value * 100)
}

/**
 * Pull a field's *literal* text out of a raw JSON body. iyzico signs the price
 * fields as they were serialized, and JSON.parse loses that formatting
 * (`10.50` -> `10.5`), so signature checks work off the literal where possible.
 */
const rawLiteral = (raw: string, field: string): string | undefined => {
  const match = new RegExp(`"${field}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|[^,}\\s]+)`).exec(raw)
  if (!match?.[1]) return undefined
  const value = match[1]
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value) as string
    } catch {
      return undefined
    }
  }
  return value
}

/**
 * iyzico's docs say to strip trailing zeros from prices before signing ("10.50" ->
 * "10.5"), but SDKs in the wild also sign "10.0" for whole amounts. Try the small
 * set of plausible renderings rather than rejecting a genuine response over
 * formatting.
 */
const priceCandidates = (raw: string, parsed: unknown, field: string): string[] => {
  const candidates = new Set<string>()
  const literal = rawLiteral(raw, field)

  if (literal) candidates.add(literal)

  const numeric = typeof parsed === 'string' ? Number(parsed) : parsed
  if (typeof numeric === 'number' && Number.isFinite(numeric)) {
    candidates.add(String(numeric))
    candidates.add(numeric.toFixed(1))
  }

  if (candidates.size === 0) candidates.add('')

  return [...candidates]
}

const signatureMatches = (expected: string, received: unknown): boolean => {
  if (typeof received !== 'string' || received.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'))
}

/**
 * Verify the signature on a Checkout Form initialize response.
 * Signed fields: conversationId:token
 */
export const verifyInitializeSignature = ({
  data,
  secretKey,
}: {
  data: { conversationId?: string; signature?: string; token?: string }
  secretKey: string
}): boolean => {
  const expected = hmacHex(`${data.conversationId ?? ''}:${data.token ?? ''}`, secretKey)
  return signatureMatches(expected, data.signature)
}

/**
 * Verify the signature on a Checkout Form retrieve response. This is what stops a
 * forged callback from marking an order paid, so a failure here is fatal.
 * Signed fields: paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token
 */
export const verifyRetrieveSignature = ({
  data,
  raw,
  secretKey,
}: {
  data: Record<string, unknown>
  raw: string
  secretKey: string
}): boolean => {
  if (typeof data.signature !== 'string') return false

  const str = (value: unknown): string => (value === undefined || value === null ? '' : String(value))

  for (const paidPrice of priceCandidates(raw, data.paidPrice, 'paidPrice')) {
    for (const price of priceCandidates(raw, data.price, 'price')) {
      const payload = [
        str(data.paymentStatus),
        str(data.paymentId),
        str(data.currency),
        str(data.basketId),
        str(data.conversationId),
        paidPrice,
        price,
        str(data.token),
      ].join(':')

      if (signatureMatches(hmacHex(payload, secretKey), data.signature)) return true
    }
  }

  return false
}
