import {type Insets, Platform} from 'react-native'
import {type Service} from '@atproto/lex'
import {AtUri} from '@atproto/syntax'

import {
  BLUESKY_PROXY_DID,
  CHAT_PROXY_DID,
  DEFAULT_SERVICE_URL,
  KRAO_CHAT_URL,
  KRAO_DISCOVER_FEED,
  KRAO_EMBED_URL,
  KRAO_GIF_URL,
  KRAO_LABELER,
  KRAO_LINK_PREVIEW_URL,
  KRAO_SITE_URL,
  KRAO_VIDEO_DID,
  KRAO_VIDEO_URL,
  PUBLIC_API_URL,
} from '#/env'
import {type app} from '#/lexicons'

export const LOCAL_DEV_SERVICE =
  Platform.OS === 'android' ? 'http://10.0.2.2:2583' : 'http://localhost:2583'
export const STAGING_SERVICE = 'https://staging.bsky.dev'
export const BSKY_SERVICE = 'https://bsky.social'
export const BSKY_SERVICE_DID = 'did:web:bsky.social'
export const PUBLIC_BSKY_SERVICE = PUBLIC_API_URL
export const DEFAULT_SERVICE = DEFAULT_SERVICE_URL
const HELP_DESK_LANG = 'en-us'
export const HELP_DESK_URL = `${KRAO_SITE_URL}/help/${HELP_DESK_LANG}`
/**
 * Krao's chat service for signed-out reads (eg join link previews), if any.
 * Signed-in chat goes through the PDS to CHAT_PROXY_DID instead.
 */
export const CHAT_SERVICE = KRAO_CHAT_URL
/** Krao's post embed service; embedding is off until one runs (KRAO_EMBED_URL) */
export const EMBED_SERVICE = KRAO_EMBED_URL
export const EMBED_SCRIPT = `${EMBED_SERVICE}/static/embed.js`
export const BSKY_DOWNLOAD_URL = `${KRAO_SITE_URL}/download`
export const STARTER_PACK_DEFAULT_SIZE = 150
export const STARTER_PACK_MAX_SIZE = 500
export const CARD_ASPECT_RATIO = 1200 / 630

// HACK
// Yes, this is exactly what it looks like. It's a hard-coded constant
// reflecting the number of new users in the last week. We don't have
// time to add a route to the servers for this so we're just going to hard
// code and update this number with each release until we can get the
// server route done.
// -prf
export const JOINED_THIS_WEEK = 560000 // estimate as of 12/18/24

/** Accounts that see feed debug info on posts */
export const DISCOVER_DEBUG_DIDS: Record<string, true> = {}

const BASE_FEEDBACK_FORM_URL = `${HELP_DESK_URL}/requests/new`
export function FEEDBACK_FORM_URL({
  email,
  handle,
}: {
  email?: string
  handle?: string
}): string {
  let str = BASE_FEEDBACK_FORM_URL
  if (email) {
    str += `?tf_anonymous_requester_email=${encodeURIComponent(email)}`
    if (handle) {
      str += `&tf_17205412673421=${encodeURIComponent(handle)}`
    }
  }
  return str
}

export const MAX_DISPLAY_NAME = 64
export const MAX_DESCRIPTION = 256

export const MAX_GRAPHEME_LENGTH = 300

export const MAX_DRAFT_GRAPHEME_LENGTH = 1000

export const MAX_DM_GRAPHEME_LENGTH = 1000

export const MAX_GROUP_NAME_GRAPHEME_LENGTH = 50

// Recommended is 100 per: https://www.w3.org/WAI/GL/WCAG20/tests/test3.html
// but increasing limit per user feedback
export const MAX_ALT_TEXT = 2000

export const MAX_REPORT_REASON_GRAPHEME_LENGTH = 2000

export function IS_TEST_USER(handle?: string) {
  return handle && handle?.endsWith('.test')
}

export function IS_PROD_SERVICE(url?: string) {
  return url && url !== STAGING_SERVICE && !url.startsWith(LOCAL_DEV_SERVICE)
}

export const IMAGE_SIZE_CONFIG_POSTS = {
  maxDimension: 4000,
  maxSize: 2000000,
}

export const IMAGE_SIZE_CONFIG_2K_1MB = {
  maxDimension: 2000,
  maxSize: 1000000,
}

/** Krao's link preview service (cardyb-compatible, see KRAO_LINK_PREVIEW_URL) */
export function LINK_META_PROXY(_serviceUrl: string) {
  return `${KRAO_LINK_PREVIEW_URL}/v1/extract?url=`
}

export const STATUS_PAGE_URL = 'https://status.krao.net/'

// Hitslop constants
export const createHitslop = (size: number): Insets => ({
  top: size,
  left: size,
  bottom: size,
  right: size,
})
export const HITSLOP_10 = createHitslop(10)
export const HITSLOP_20 = createHitslop(20)
export const HITSLOP_30 = createHitslop(30)
export const LANG_DROPDOWN_HITSLOP = {top: 10, bottom: 10, left: 4, right: 4}
export const BACK_HITSLOP = HITSLOP_30
export const MAX_POST_LINES = 25

/**
 * Feeds whose generators get the user's interests as a header. Krao's own
 * feed does not use them, and they are not sent to anyone else's.
 */
export const BSKY_FEED_OWNER_DIDS: string[] = []

export const TRENDING_DID = 'did:plc:qrz3lhbyuxbeilrc6nekdqme'
export const TRENDING_HANDLE = 'trending.bsky.app'

/**
 * The Discover feed: Krao's "latest" feed (KRAO_DISCOVER_FEED). Holds the
 * DID form once resolveKraoServices() has run at startup, since AppViews
 * only know feeds by DID.
 */
// oxlint-disable-next-line import/no-mutable-exports -- set once at startup
export let DISCOVER_FEED_URI = KRAO_DISCOVER_FEED

/**
 * DID of Krao's labeler (KRAO_LABELER), set by resolveKraoServices() at
 * startup. Empty when none is configured or it did not resolve.
 */
// oxlint-disable-next-line import/no-mutable-exports -- set once at startup
export let KRAO_LABELER_DID = ''

/**
 * Resolves the handles that the Discover feed and the labeler may be
 * configured with. Runs before the app renders.
 */
export async function resolveKraoServices() {
  const feed = new AtUri(KRAO_DISCOVER_FEED)
  const [feedOwnerDid, labelerDid] = await Promise.all([
    resolveHandle(feed.host),
    resolveHandle(KRAO_LABELER),
  ])
  if (feedOwnerDid) {
    DISCOVER_FEED_URI = `at://${feedOwnerDid}/${feed.collection}/${feed.rkey}`
  }
  KRAO_LABELER_DID = KRAO_LABELER.startsWith('did:')
    ? KRAO_LABELER
    : (labelerDid ?? '')
}

/**
 * A handle's DID from the AppView, or undefined if it is not a handle or does
 * not resolve. Callers keep their configured value then: that one feature
 * fails, the rest of the app works.
 */
async function resolveHandle(handle: string) {
  if (!handle || handle.startsWith('did:')) return undefined
  try {
    const url = new URL(
      '/xrpc/com.atproto.identity.resolveHandle',
      PUBLIC_API_URL,
    )
    url.searchParams.set('handle', handle)
    const res = await fetch(url, {signal: AbortSignal.timeout(5000)})
    return ((await res.json()) as {did?: string}).did
  } catch {
    return undefined
  }
}

/** Krao has no video feed yet, so Bluesky's video feed UI stays off */
export const VIDEO_FEED_URI = ''
export const VIDEO_FEED_URIS: string[] = []

export const DISCOVER_SAVED_FEED = {
  type: 'feed',
  get value() {
    return DISCOVER_FEED_URI
  },
  pinned: true,
}
export const TIMELINE_SAVED_FEED = {
  type: 'timeline',
  value: 'following',
  pinned: true,
}

export const RECOMMENDED_SAVED_FEEDS: Pick<
  app.bsky.actor.defs.SavedFeed,
  'type' | 'value' | 'pinned'
>[] = [DISCOVER_SAVED_FEED, TIMELINE_SAVED_FEED]

export const KNOWN_SHUTDOWN_FEEDS = [
  'at://did:plc:wqowuobffl66jv3kpsvo7ak4/app.bsky.feed.generator/the-algorithm', // for you by skygaze
]

/** Krao's GIF service (the indexer, see KRAO_GIF_URL) */
export const GIF_SERVICE = KRAO_GIF_URL

/**
 * A Tenor ('t') or Klipy ('k') media URL relayed through Krao's GIF service,
 * so viewers never contact the provider's CDN themselves.
 */
export function GIF_MEDIA_URL(provider: 't' | 'k', path: string) {
  return `${GIF_SERVICE}/gifs/${provider}/${path.replace(/^\/+/, '')}`
}

export const GIF_KLIPY_SEARCH = (params: string) =>
  `${GIF_SERVICE}/klipy/v2/search?${params}`
export const GIF_KLIPY_FEATURED = (params: string) =>
  `${GIF_SERVICE}/klipy/v2/featured?${params}`

export const MAX_LABELERS = 20

/**
 * Krao's video service (upload and transcoding) and the DID it answers to.
 * Video uploads are off until one is configured.
 */
export const VIDEO_SERVICE = KRAO_VIDEO_URL
export const VIDEO_SERVICE_DID = KRAO_VIDEO_DID

export const VIDEO_MAX_DURATION_MS = 10 * 60 * 1000 // 10 minutes in milliseconds
/**
 * Maximum size of a video in megabytes, _not_ mebibytes. Backend uses
 * ISO megabytes.
 */
export const VIDEO_MAX_SIZE_MB = 300
export const VIDEO_MAX_SIZE = VIDEO_MAX_SIZE_MB * 1000 * 1000 // 300mb

export const SUPPORTED_MIME_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/webm',
  'video/quicktime',
  'image/gif',
] as const

export type SupportedMimeTypes = (typeof SUPPORTED_MIME_TYPES)[number]

export const EMOJI_REACTION_LIMIT = 5

/**
 * Help articles on Krao's website. Krao has no blog posts of its own yet, so
 * what upstream links to as announcements points at help articles instead.
 */
export const urls = {
  website: {
    blog: {
      findFriendsAnnouncement: `${KRAO_SITE_URL}/support/find-friends`,
      initialVerificationAnnouncement: `${KRAO_SITE_URL}/support/verification`,
      searchTipsAndTricks: `${KRAO_SITE_URL}/support/search`,
    },
    support: {
      findFriendsPrivacyPolicy: `${KRAO_SITE_URL}/support/find-friends-privacy-policy`,
    },
  },
}

/**
 * The AppView for direct reads (eg logged-out feeds) and the DID it answers
 * to: Krao's, as configured for the rest of the app.
 */
export const PUBLIC_APPVIEW = PUBLIC_API_URL
export const PUBLIC_APPVIEW_DID = BLUESKY_PROXY_DID
export const PUBLIC_STAGING_APPVIEW_DID = 'did:web:api.staging.bsky.dev'

// temp hack for e2e - esb
export const BLUESKY_PROXY_HEADER = {
  value: `${BLUESKY_PROXY_DID}#bsky_appview`,
  get() {
    return this.value as Service
  },
  set(value: string) {
    this.value = value
  },
}

/**
 * The chat service's proxy target, in the `did#service_id` form a lex client's
 * `service` option takes. A client constructed with it emits `atproto-proxy:
 * <this value>` on every request, which is what routes `chat.bsky.*` calls to
 * the chat service.
 *
 * The DID comes from the env-configurable `CHAT_PROXY_DID` (via
 * `EXPO_PUBLIC_CHAT_PROXY_DID`) rather than a hard-coded constant, so the
 * target can be retargeted per environment.
 */
export const CHAT_PROXY_SERVICE: Service = `${CHAT_PROXY_DID}#bsky_chat`

/**
 * Krao's moderation service, in the `did#service_id` form a lex client's
 * per-call `service` option takes. Passing it emits `atproto-proxy: <this
 * value>` on that one request, routing a `com.atproto.moderation.*` call to
 * Krao's labeler. Without a labeler it is undefined, and the PDS hands the
 * call to the moderation service it is configured with.
 *
 * Reports and appeals aimed at a DIFFERENT labeler build their own value from
 * that labeler's creator did instead, so this is a per-call option rather than a
 * client-level one like {@link CHAT_PROXY_SERVICE}.
 */
export function modProxyService(): Service | undefined {
  return KRAO_LABELER_DID
    ? (`${KRAO_LABELER_DID}#atproto_labeler` as Service)
    : undefined
}

/**
 * The notification service's proxy target, in the `did#service_id` form a lex
 * client's per-call `service` option takes. Passing it emits `atproto-proxy:
 * <this value>` on that one request, which is what routes push registration to
 * the notification service (replaces the old
 * `BLUESKY_NOTIF_SERVICE_HEADERS`).
 */
export const NOTIF_SERVICE: Service = `${BLUESKY_PROXY_DID}#bsky_notif`

/** Krao's policy and help pages */
export const webLinks = {
  tos: `${KRAO_SITE_URL}/terms`,
  privacy: `${KRAO_SITE_URL}/privacy`,
  copyright: `${KRAO_SITE_URL}/copyright`,
  community: `${KRAO_SITE_URL}/community-guidelines`,
  support: `${KRAO_SITE_URL}/support`,
  faq: `${KRAO_SITE_URL}/support/faq`,
  customHandle: `${KRAO_SITE_URL}/support/custom-handle`,
  dataExport: `${KRAO_SITE_URL}/support/data-export`,
  reportNcii: `${KRAO_SITE_URL}/support/report-ncii`,
}
