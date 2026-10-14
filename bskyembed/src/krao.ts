/*
 * Krao hosts the embed talks to. Set at build time (Vite env); the defaults
 * are krao.net's.
 */

/** Krao's public AppView, which serves the posts being embedded */
export const APPVIEW_URL: string =
  import.meta.env.VITE_KRAO_APPVIEW_URL || 'https://api.krao.net'

/** Krao's web app, where links in an embed lead */
export const WEB_URL: string =
  import.meta.env.VITE_KRAO_WEB_URL || 'https://krao.net'

/** Where this embed service itself is served */
export const EMBED_URL: string =
  import.meta.env.VITE_KRAO_EMBED_URL || 'https://embed.krao.net'

/** Domain of handles on Krao's PDS, dropped in short profile URLs */
export const HANDLE_DOMAIN: string =
  import.meta.env.VITE_KRAO_HANDLE_DOMAIN || '.krao.net'

/** Krao's indexer, which renders starter pack cards */
export const INDEXER_URL: string =
  import.meta.env.VITE_KRAO_INDEXER_URL || 'https://idx.krao.net'

/** Whether a link points into Krao's web app */
export function isWebUrl(url: string): boolean {
  try {
    return new URL(url).host === new URL(WEB_URL).host
  } catch {
    return false
  }
}
