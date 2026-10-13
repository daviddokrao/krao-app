import {GIF_MEDIA_URL} from '#/lib/constants'
import {logger} from '#/logger'

/**
 * Rewrites a provider's CDN URL (Tenor or Klipy) to go through Krao's GIF
 * relay. Leaves unrecognized hosts untouched.
 */
export function gifPreviewUrl(gifUrl: string) {
  try {
    const url = new URL(gifUrl)
    if (url.hostname === 'media.tenor.com') {
      return GIF_MEDIA_URL('t', url.pathname + url.search)
    }
    if (url.hostname === 'static.klipy.com') {
      return GIF_MEDIA_URL('k', url.pathname + url.search)
    }
    return gifUrl
  } catch (e) {
    logger.debug('invalid url passed to gifPreviewUrl()')
    return ''
  }
}

/**
 * Rewrites a KLIPY static CDN URL through Krao's GIF relay, so downstream
 * consumers never contact Klipy directly.
 */
export function klipyUrlToGifRelayUrl(klipyUrl: string) {
  let url
  try {
    url = new URL(klipyUrl)
  } catch (e) {
    logger.debug('invalid url passed to klipyUrlToGifRelayUrl()')
    return ''
  }
  return GIF_MEDIA_URL('k', url.pathname + url.search)
}
