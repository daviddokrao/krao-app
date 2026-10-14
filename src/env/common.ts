import {type DidString} from '@atproto/syntax'

import packageJson from '#/../package.json'

/**
 * The semver version of the app, as defined in `package.json.`
 *
 * N.B. The fallback is needed for Render.com deployments
 */
export const RELEASE_VERSION: string =
  process.env.EXPO_PUBLIC_RELEASE_VERSION || packageJson.version

/**
 * The env the app is running in e.g. development, testflight, production, e2e
 */
export const ENV: string = process.env.EXPO_PUBLIC_ENV as
  'production' | 'testflight' | 'development' | 'e2e' | (string & {})

/**
 * Indicates whether the app is running in TestFlight
 */
export const IS_TESTFLIGHT = ENV === 'testflight'

/**
 * Indicates whether the app is `__DEV__`
 */
export const IS_DEV = __DEV__

/**
 * Indicates whether the app is running in a test environment
 */
export const IS_E2E = ENV === 'e2e'

/**
 * Indicates whether the app is `__DEV__` or TestFlight
 */
export const IS_INTERNAL = IS_DEV || IS_TESTFLIGHT

/**
 * The commit hash that the current bundle was made from. The user can
 * see the commit hash in the app's settings along with the other version info.
 * Useful for debugging/reporting.
 */
export const BUNDLE_IDENTIFIER: string =
  process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER || 'dev'

/**
 * This will always be in the format of YYMMDDHH, so that it always increases
 * for each build. This should only be used for analytics reporting and shouldn't
 * be used to identify a specific bundle.
 */
export const BUNDLE_DATE: number =
  process.env.EXPO_PUBLIC_BUNDLE_DATE === undefined
    ? 0
    : Number(process.env.EXPO_PUBLIC_BUNDLE_DATE)

/**
 * The log level for the app.
 */
export const LOG_LEVEL = (process.env.EXPO_PUBLIC_LOG_LEVEL || 'info') as
  'debug' | 'info' | 'warn' | 'error'

/**
 * Enable debug logs for specific logger instances
 */
export const LOG_DEBUG: string = process.env.EXPO_PUBLIC_LOG_DEBUG || ''

/**
 * The DID of the Bluesky appview to proxy to
 */
export const BLUESKY_PROXY_DID: DidString =
  process.env.EXPO_PUBLIC_BLUESKY_PROXY_DID || 'did:web:api.krao.net'

/**
 * The PDS used for sign up and as the default sign in provider
 */
export const DEFAULT_SERVICE_URL: string =
  process.env.EXPO_PUBLIC_DEFAULT_SERVICE || 'https://pds.krao.net'

/**
 * The public appview used for logged-out requests
 */
export const PUBLIC_API_URL: string =
  process.env.EXPO_PUBLIC_PUBLIC_API || 'https://api.krao.net'

/**
 * Krao's web app, which also hosts pages native apps embed (eg the YouTube
 * player)
 */
export const KRAO_WEB_URL: string =
  process.env.EXPO_PUBLIC_KRAO_WEB_URL || 'https://krao.net'

/**
 * Krao's public website, home of the help center and the policy pages (terms,
 * privacy, community guidelines...)
 */
export const KRAO_SITE_URL: string =
  process.env.EXPO_PUBLIC_KRAO_SITE_URL || 'https://krao.net'

/**
 * The handle domain of accounts on Krao's PDS, with its leading dot. Profile
 * URLs drop it: `krao.net/lan` is the profile of `lan.krao.net`.
 */
export const KRAO_HANDLE_DOMAIN: string = (() => {
  const domain: string =
    process.env.EXPO_PUBLIC_KRAO_HANDLE_DOMAIN || '.krao.net'
  return (domain.startsWith('.') ? domain : `.${domain}`).toLowerCase()
})()

/**
 * Krao indexer serving net.krao.* queries (linked wallets etc)
 */
export const KRAO_INDEXER_URL: string =
  process.env.EXPO_PUBLIC_KRAO_INDEXER_URL || 'https://indexer.krao.net'

/**
 * Krao gate service holding token-gated post content, and the DID it answers
 * to (the audience of the service auth tokens sent to it)
 */
export const KRAO_GATE_URL: string =
  process.env.EXPO_PUBLIC_KRAO_GATE_URL || KRAO_INDEXER_URL

/**
 * Krao's link preview service (cardyb-compatible `/v1/extract` and
 * `/v1/image`), served by the indexer
 */
export const KRAO_LINK_PREVIEW_URL: string =
  process.env.EXPO_PUBLIC_KRAO_LINK_PREVIEW_URL || KRAO_INDEXER_URL

/**
 * Krao's GIF service (the indexer): relays Tenor/Klipy media and forwards GIF
 * search. Search needs an API key on the server, so the GIF picker only shows
 * when KRAO_GIF_SEARCH is enabled.
 */
export const KRAO_GIF_URL: string =
  process.env.EXPO_PUBLIC_KRAO_GIF_URL || KRAO_INDEXER_URL
export const KRAO_GIF_SEARCH: boolean =
  process.env.EXPO_PUBLIC_KRAO_GIF_SEARCH === 'true'

/**
 * Krao's post embed service (a bskyembed deployment). "Embed post" is hidden
 * until one is configured.
 */
export const KRAO_EMBED_URL: string =
  process.env.EXPO_PUBLIC_KRAO_EMBED_URL || ''

/**
 * Krao's link shortener (bskylink-compatible, on the indexer), used to share
 * starter packs; short links are `<this URL>/<code>`
 */
export const KRAO_SHORT_LINK_URL: string =
  process.env.EXPO_PUBLIC_KRAO_SHORT_LINK_URL || `${KRAO_INDEXER_URL}/s`

/** Krao's share card images for starter packs (on the indexer) */
export const KRAO_OGCARD_URL: string =
  process.env.EXPO_PUBLIC_KRAO_OGCARD_URL || `${KRAO_INDEXER_URL}/ogcard`

/**
 * Krao's video service (app.bsky.video.* upload and transcoding) and its DID.
 * Video uploads are off until one is configured.
 */
export const KRAO_VIDEO_URL: string =
  process.env.EXPO_PUBLIC_KRAO_VIDEO_URL || ''
export const KRAO_VIDEO_DID: string =
  process.env.EXPO_PUBLIC_KRAO_VIDEO_DID || ''

/** Krao's chat service URL for signed-out reads; unset, there are none */
export const KRAO_CHAT_URL: string = process.env.EXPO_PUBLIC_KRAO_CHAT_URL || ''
export const KRAO_GATE_DID: string =
  process.env.EXPO_PUBLIC_KRAO_GATE_DID || 'did:web:gate.krao.net'

/**
 * Krao's "popular" feed, the app's Discover feed. Its owner may be given by
 * handle; the app resolves it to a DID on startup (see resolveKraoServices).
 */
export const KRAO_DISCOVER_FEED: string =
  process.env.EXPO_PUBLIC_KRAO_DISCOVER_FEED ||
  'at://krao.net/app.bsky.feed.generator/popular'

/**
 * Krao's moderation service (labeler), by DID or handle. It labels content
 * for everyone and receives reports and appeals. Unset, no app labeler is
 * used.
 */
export const KRAO_LABELER: string = process.env.EXPO_PUBLIC_KRAO_LABELER || ''

/**
 * Enables a built-in test wallet (the public Hardhat dev key) for local
 * development without a browser wallet extension. Never enable in production.
 */
export const KRAO_DEV_WALLET: boolean =
  process.env.EXPO_PUBLIC_KRAO_DEV_WALLET === 'true'

/**
 * JSON-RPC of the local dev chain (Anvil) that the dev wallet sends
 * transactions through.
 */
export const KRAO_DEV_RPC_URL: string =
  process.env.EXPO_PUBLIC_KRAO_DEV_RPC_URL || 'http://localhost:8545'

/**
 * The DID of the chat service to proxy to
 */
export const CHAT_PROXY_DID: DidString =
  process.env.EXPO_PUBLIC_CHAT_PROXY_DID || 'did:web:chat.krao.net'

/**
 * Metrics API host. Metrics are disabled when unset.
 */
export const METRICS_API_HOST: string =
  process.env.EXPO_PUBLIC_METRICS_API_HOST || ''

/**
 * Growthbook API host. Feature flags fall back to defaults when unset.
 */
export const GROWTHBOOK_API_HOST: string =
  process.env.EXPO_PUBLIC_GROWTHBOOK_API_HOST ||
  (METRICS_API_HOST ? `${METRICS_API_HOST}/gb` : '')

/**
 * Growthbook client key
 */
export const GROWTHBOOK_CLIENT_KEY: string =
  process.env.EXPO_PUBLIC_GROWTHBOOK_CLIENT_KEY || ''

/**
 * Sentry DSN for telemetry
 */
export const SENTRY_DSN: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN

/**
 * Bitdrift API key. If undefined, Bitdrift should be disabled.
 */
export const BITDRIFT_API_KEY: string | undefined =
  process.env.EXPO_PUBLIC_BITDRIFT_API_KEY

/**
 * GCP project ID which is required for native device attestation. On web, this
 * should be unset and evaluate to 0.
 */
export const GCP_PROJECT_ID: number =
  process.env.EXPO_PUBLIC_GCP_PROJECT_ID === undefined
    ? 0
    : Number(process.env.EXPO_PUBLIC_GCP_PROJECT_ID)

/**
 * URLs for the app config web worker. Can be a
 * locally running server, see `env.example` for more.
 */
export const GEOLOCATION_DEV_URL = process.env.GEOLOCATION_DEV_URL
export const GEOLOCATION_PROD_URL = `https://ip.krao.net`
export const GEOLOCATION_URL = IS_DEV
  ? (GEOLOCATION_DEV_URL ?? GEOLOCATION_PROD_URL)
  : GEOLOCATION_PROD_URL

/**
 * URLs for the live-event config web worker. Can be a
 * locally running server, see `env.example` for more.
 */
export const LIVE_EVENTS_DEV_URL = process.env.LIVE_EVENTS_DEV_URL
export const LIVE_EVENTS_PROD_URL = `https://live-events.krao.net`
export const LIVE_EVENTS_URL = IS_DEV
  ? (LIVE_EVENTS_DEV_URL ?? LIVE_EVENTS_PROD_URL)
  : LIVE_EVENTS_PROD_URL

/**
 * URLs for the app-config web worker. Can be a
 * locally running server, see `env.example` for more.
 */
export const APP_CONFIG_DEV_URL = process.env.APP_CONFIG_DEV_URL
export const APP_CONFIG_PROD_URL = `https://app-config.krao.net`
export const APP_CONFIG_URL = IS_DEV
  ? (APP_CONFIG_DEV_URL ?? APP_CONFIG_PROD_URL)
  : APP_CONFIG_PROD_URL
