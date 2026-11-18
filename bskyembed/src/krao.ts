import brand from '../../brand.json'

/*
 * Krao hosts the embed talks to. Set at build time (Vite env); the defaults
 * come from brand.json (the app's brand file).
 */

/** The product name shown to users */
export const BRAND_NAME: string = brand.name

const host = (key: keyof typeof brand.hosts) =>
  `https://${brand.hosts[key]}.${brand.domain}`

/** Krao's public AppView, which serves the posts being embedded */
export const APPVIEW_URL: string =
  import.meta.env.VITE_KRAO_APPVIEW_URL || host('api')

/** Krao's web app, where links in an embed lead */
export const WEB_URL: string =
  import.meta.env.VITE_KRAO_WEB_URL || `https://${brand.domain}`

/** Where this embed service itself is served */
export const EMBED_URL: string =
  import.meta.env.VITE_KRAO_EMBED_URL || host('embed')

/** Domain of handles on Krao's PDS, dropped in short profile URLs */
export const HANDLE_DOMAIN: string =
  import.meta.env.VITE_KRAO_HANDLE_DOMAIN || `.${brand.domain}`

/** Krao's indexer, which renders starter pack cards */
export const INDEXER_URL: string =
  import.meta.env.VITE_KRAO_INDEXER_URL || host('indexer')

/** Whether a link points into Krao's web app */
export function isWebUrl(url: string): boolean {
  try {
    return new URL(url).host === new URL(WEB_URL).host
  } catch {
    return false
  }
}

/** The official account's handle, used in example links */
export const OFFICIAL_HANDLE: string = brand.social.officialHandle
