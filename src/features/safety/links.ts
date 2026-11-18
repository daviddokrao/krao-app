import {createBatchLoader} from '#/lib/batchLoader'
import {isBskyAppUrl} from '#/lib/strings/url-helpers'
import {checkLinksRequest, type LinkResult} from './api'

/*
 * Link safety: Krao's indexer keeps a list of phishing and wallet-draining
 * domains. Results are kept in memory (a link seen twice is asked about
 * once), and links asked about together share one request.
 */

/** A "safe" answer is asked again after this long, an "unsafe" one later */
const SAFE_TTL_MS = 10 * 60 * 1000
const UNSAFE_TTL_MS = 60 * 60 * 1000

/** Longest wait before a link opens regardless; the list is a safeguard */
export const LINK_CHECK_TIMEOUT_MS = 2500

type Entry = {result: LinkResult; at: number}

const cache = new Map<string, Entry>()

const loadLink = createBatchLoader<string, LinkResult>({
  maxBatchSize: 20,
  load: async urls => {
    const results = await checkLinksRequest(urls)
    const loaded = new Map<string, LinkResult>()
    urls.forEach((url, i) => {
      const result = results[i]
      if (result) {
        loaded.set(url, result)
        cache.set(url, {result, at: Date.now()})
      }
    })
    return loaded
  },
})

/** Whether `url` is a web link to somewhere outside Krao */
export function isCheckableLink(url: string): boolean {
  return /^https?:\/\//i.test(url) && !isBskyAppUrl(url)
}

/** What is already known about `url`, if it is fresh enough */
export function getCachedLinkSafety(
  url: string,
  now = Date.now(),
): LinkResult | undefined {
  const entry = cache.get(url)
  if (!entry) return
  const ttl = entry.result.unsafe ? UNSAFE_TTL_MS : SAFE_TTL_MS
  if (now - entry.at > ttl) {
    cache.delete(url)
    return
  }
  return entry.result
}

/**
 * Asks about `url` (or answers from memory). Never throws: when the service
 * cannot be reached the answer is `undefined`, and links open as before.
 */
export async function getLinkSafety(
  url: string,
): Promise<LinkResult | undefined> {
  if (!isCheckableLink(url)) return
  const cached = getCachedLinkSafety(url)
  if (cached) return cached
  try {
    return await loadLink(url)
  } catch {
    return
  }
}

/** Like getLinkSafety, but gives up (with `undefined`) after `timeoutMs` */
export async function getLinkSafetyWithin(
  url: string,
  timeoutMs = LINK_CHECK_TIMEOUT_MS,
): Promise<LinkResult | undefined> {
  const cached = getCachedLinkSafety(url)
  if (cached || !isCheckableLink(url)) return cached
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<undefined>(resolve => {
    timer = setTimeout(() => resolve(undefined), timeoutMs)
  })
  try {
    return await Promise.race([getLinkSafety(url), timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Forgets what was learned (tests) */
export function clearLinkSafetyCache() {
  cache.clear()
}
