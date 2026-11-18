import brandJson from '#/../brand.json'

/**
 * The brand: product name, domain, hosts, app identity. One source
 * (`brand.json` at the repo root, also read by `app.config.js`), so editing it
 * renames the app. Keep the schema in sync with the backend's `@krao/brand`.
 */
export const BRAND = brandJson

/** The product name shown to users */
export const BRAND_NAME: string = BRAND.name

/** The service keys of `brand.json` `hosts` */
export type BrandHostKey = keyof typeof BRAND.hosts

/**
 * The hostname of a Krao service, eg `api.krao.net`
 */
export function brandHost(key: BrandHostKey): string {
  return `${BRAND.hosts[key]}.${BRAND.domain}`
}

/**
 * The base URL of a Krao service, eg `https://api.krao.net`
 */
export function brandUrl(key: BrandHostKey): string {
  return `https://${brandHost(key)}`
}

/**
 * The DID of a Krao service, eg `did:web:api.krao.net`
 */
export function brandDid(key: BrandHostKey): `did:web:${string}` {
  return `did:web:${brandHost(key)}`
}

/**
 * A URL on the brand's website. With no path (or an empty one) there is no
 * trailing slash: `webUrl()` is `https://krao.net`, `webUrl('/terms')` is
 * `https://krao.net/terms`.
 */
export function webUrl(path = ''): string {
  const base = `https://${BRAND.domain}`
  if (!path) return base
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}
