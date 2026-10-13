/*
 * Short profile URLs: `krao.net/lan` instead of `krao.net/profile/lan.krao.net`.
 *
 * The first path segment is a profile when it is not one of the app's own
 * pages. Handles on Krao's PDS drop their domain (KRAO_HANDLE_DOMAIN); other
 * handles keep it (they contain a dot, which no app page does) and DIDs stay
 * under /profile. Krao's PDS refuses handles that clash with app pages (see
 * krao-reserved.ts in krao-atproto), and RESERVED_PATHS below must stay in
 * step with it.
 */
import {KRAO_HANDLE_DOMAIN} from '#/env'
import {router} from '#/routes'

/** Top-level paths that are not routes but are served or handled by the app */
const EXTRA_RESERVED = [
  'about',
  'account',
  'admin',
  'api',
  'auth',
  'chat',
  'community-guidelines',
  'copyright',
  'embed',
  'explore',
  'help',
  'home',
  'iframe',
  'intent',
  'login',
  'logout',
  'oauth',
  'ogcard',
  'privacy',
  'rss',
  'signup',
  'static',
  'terms',
  'wallet',
  'xrpc',
]

let reserved: Set<string> | undefined

/** First path segments that belong to the app rather than to a profile */
export function getReservedPaths(): Set<string> {
  if (!reserved) {
    reserved = new Set(EXTRA_RESERVED)
    for (const [, route] of router.routes) {
      const first = route.pattern.split('/')[1]
      if (first && !first.startsWith(':')) reserved.add(first.toLowerCase())
    }
  }
  return reserved
}

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i
const PROFILE_PATH_RE = /^\/profile\/([^/?#]+)(.*)$/s

/**
 * `/profile/lan.krao.net/post/x` -> `/lan/post/x`. Paths that cannot be
 * shortened safely (DIDs, names that clash with app pages) are returned as is.
 */
export function shortenProfilePath(path: string): string {
  const match = PROFILE_PATH_RE.exec(path)
  if (!match) return path
  const name = decodeURIComponent(match[1])
  const lower = name.toLowerCase()
  const rest = match[2]
  if (lower.startsWith('did:')) return path
  if (lower.endsWith(KRAO_HANDLE_DOMAIN)) {
    const label = name.slice(0, -KRAO_HANDLE_DOMAIN.length)
    if (LABEL_RE.test(label) && !getReservedPaths().has(label.toLowerCase())) {
      return `/${label}${rest}`
    }
    return path
  }
  return lower.includes('.') ? `/${name}${rest}` : path
}

/**
 * `/lan/post/x` -> `/profile/lan.krao.net/post/x`. Paths of app pages are
 * returned as is. Accepts paths with or without a leading slash.
 */
export function expandProfilePath(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`
  const match = /^\/([^/?#]+)(.*)$/s.exec(withSlash)
  if (!match) return path
  const first = decodeURIComponent(match[1])
  const rest = match[2]
  const lower = first.toLowerCase()
  if (getReservedPaths().has(lower)) return path
  if (lower.startsWith('did:') || lower.includes('.')) {
    return `/profile/${first}${rest}`
  }
  if (LABEL_RE.test(first)) {
    return `/profile/${lower}${KRAO_HANDLE_DOMAIN}${rest}`
  }
  return path
}
