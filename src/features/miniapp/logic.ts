/*
 * Mini Apps: the registry views of the indexer (net.krao.miniapp.*) and the
 * small pure helpers around them. The SDK message handling is in bridge.ts
 * and the transaction preview in preview.ts.
 */

export type Permission = 'identity' | 'wallet' | 'sign' | 'transaction'

export const PERMISSIONS: Permission[] = [
  'identity',
  'wallet',
  'sign',
  'transaction',
]

export type MiniAppStatus = 'approved' | 'pending' | 'revoked' | 'invalid'

export type MiniAppView = {
  uri: string
  cid: string
  developer: string
  name: string
  description?: string
  url: string
  origin: string
  iconUrl?: string
  permissions: string[]
  chains?: string[]
  status: MiniAppStatus
  /** Why it was revoked: an admin's note, `unsafeDomain` or `developerTakenDown` */
  revokedReason?: string
  invalidReason?: string
  approvedAt?: string
  indexedAt: string
}

/** The only chain the Mini App SDK and the simulation support */
export const MINIAPP_CHAIN = 'eip155:8453'

/** The strongRef a post's net.krao.embed.miniapp points at */
export type MiniAppRef = {uri: string; cid: string}

const MINIAPP_COLLECTION = 'net.krao.miniapp.app'
const EMBED_TYPE = 'net.krao.embed.miniapp'

/** Permissions the app declares, without anything this client does not know */
export function knownPermissions(permissions: string[]): Permission[] {
  return PERMISSIONS.filter(p => permissions.includes(p))
}

/**
 * A Mini App runs only once Krao has approved its current version. The
 * status is the indexer's; everything else (pending, revoked, invalid) stays
 * closed.
 */
export function canRunApp(app: Pick<MiniAppView, 'status'> | undefined) {
  return app?.status === 'approved'
}

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/**
 * The origin to hold the app to, from the URL of its manifest: the one the
 * indexer reports, checked against the URL so a mismatch cannot widen what
 * the host trusts. Returns undefined when the two disagree, or when the URL
 * is not https (plain http is only for a dev server on this machine).
 */
export function manifestOrigin(
  app: Pick<MiniAppView, 'url' | 'origin'>,
): string | undefined {
  try {
    const fromUrl = new URL(app.url)
    const secure = fromUrl.protocol === 'https:'
    const loopback =
      fromUrl.protocol === 'http:' && LOOPBACK_HOSTS.includes(fromUrl.hostname)
    if (!secure && !loopback) return undefined
    if (fromUrl.username || fromUrl.password) return undefined
    if (fromUrl.origin === 'null' || fromUrl.origin !== app.origin) {
      return undefined
    }
    return fromUrl.origin
  } catch {
    return undefined
  }
}

/**
 * The host of the Mini App must not be able to talk to the app as itself:
 * an iframe on the web app's own origin would share its storage and tokens.
 */
export function isSameOriginAsHost(origin: string, hostOrigin: string) {
  return origin === hostOrigin
}

/** `at://did/net.krao.miniapp.app/rkey` from the route parts */
export function miniAppUri(did: string, rkey: string) {
  return `at://${did}/${MINIAPP_COLLECTION}/${rkey}`
}

/** The did and rkey of a Mini App record uri, or undefined */
export function parseMiniAppUri(
  uri: string,
): {did: string; rkey: string} | undefined {
  const match =
    /^at:\/\/(did:[a-z0-9]+:[A-Za-z0-9._:%-]+)\/([^/]+)\/([^/]+)$/.exec(uri)
  if (!match || match[2] !== MINIAPP_COLLECTION) return undefined
  return {did: match[1], rkey: match[3]}
}

/** The in-app path of a Mini App */
export function miniAppPath(uri: string): string | undefined {
  const parsed = parseMiniAppUri(uri)
  return parsed ? `/miniapp/${parsed.did}/${parsed.rkey}` : undefined
}

/**
 * The Mini App ref of a post record's embed, if it has one. Reads the open
 * union the AppView ignores, so it checks the shape itself.
 */
export function miniAppRefFromEmbed(embed: unknown): MiniAppRef | undefined {
  if (!embed || typeof embed !== 'object') return undefined
  const e = embed as {$type?: unknown; app?: unknown}
  if (e.$type !== EMBED_TYPE) return undefined
  const app = e.app as {uri?: unknown; cid?: unknown} | undefined
  if (
    !app ||
    typeof app.uri !== 'string' ||
    typeof app.cid !== 'string' ||
    !parseMiniAppUri(app.uri)
  ) {
    return undefined
  }
  return {uri: app.uri, cid: app.cid}
}

/** The `embed` of a post that shows this Mini App */
export function buildMiniAppEmbed(ref: MiniAppRef) {
  return {
    $type: EMBED_TYPE,
    app: {uri: ref.uri, cid: ref.cid},
  }
}

/**
 * A Mini App link pasted into the composer: the app's own path, an absolute
 * URL of Krao's web app, or its at:// uri. Returns the record uri.
 */
export function parseMiniAppLink(input: string): string | undefined {
  const text = input.trim()
  if (!text) return undefined
  if (text.startsWith('at://')) {
    return parseMiniAppUri(text) ? text : undefined
  }
  let path = text
  if (/^https?:\/\//i.test(text)) {
    try {
      path = new URL(text).pathname
    } catch {
      return undefined
    }
  }
  const match = /^\/miniapp\/([^/]+)\/([^/]+)\/?$/.exec(path)
  if (!match) return undefined
  try {
    const uri = miniAppUri(
      decodeURIComponent(match[1]),
      decodeURIComponent(match[2]),
    )
    return parseMiniAppUri(uri) ? uri : undefined
  } catch {
    return undefined
  }
}

/**
 * The record uri of a link to a Mini App on Krao's own web app (one of
 * `hostOrigins`), or undefined. Used for links typed or pasted into a post,
 * so a `/miniapp/...` path on any other site stays an ordinary link.
 */
export function kraoMiniAppLinkUri(
  url: string,
  hostOrigins: readonly string[],
): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return undefined
  }
  if (!hostOrigins.includes(parsed.origin)) return undefined
  return parseMiniAppLink(parsed.pathname)
}

/** Where a platform string for the SDK comes from */
export type MiniAppPlatform = 'web' | 'ios' | 'android'
