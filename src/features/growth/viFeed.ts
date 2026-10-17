import {AtUri} from '@atproto/syntax'

import {resolveHandle} from '#/lib/constants'
import {KRAO_VI_FEED} from '#/env'

/** Whether an app language code (eg "vi" or "vi-VN") is Vietnamese */
export function isVietnamese(appLanguage: string) {
  return appLanguage.toLowerCase().split('-')[0] === 'vi'
}

/**
 * The feed at-uri with its owner as a DID, which AppViews need. Handle
 * owners go through `resolve`; undefined when the uri is invalid or the
 * handle does not resolve.
 */
export async function toDidFeedUri(
  uri: string,
  resolve: (handle: string) => Promise<string | undefined> = resolveHandle,
): Promise<string | undefined> {
  if (!uri) return undefined
  let feed: AtUri
  try {
    feed = new AtUri(uri)
  } catch {
    return undefined
  }
  if (!feed.collection || !feed.rkey) return undefined
  if (feed.host.startsWith('did:')) return uri
  const did = await resolve(feed.host)
  return did ? `at://${did}/${feed.collection}/${feed.rkey}` : undefined
}

/**
 * The Vietnamese feed to pin for a new account, when EXPO_PUBLIC_KRAO_VI_FEED
 * is set and the account's app language is Vietnamese
 */
export async function getViFeedToPin(appLanguage: string) {
  if (!KRAO_VI_FEED || !isVietnamese(appLanguage)) return undefined
  return toDidFeedUri(KRAO_VI_FEED)
}
