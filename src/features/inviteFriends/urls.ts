/**
 * URL helpers for the Invite Friends share sheet (APP-2142).
 *
 * Every action (QR payload, share sheet, clipboard) and the displayed label
 * all derive from the same canonical profile URL, in its short form
 * (`https://krao.net/{name}`, see #/lib/routes/shortProfile), so what the user
 * reads matches exactly what they copy/share. The displayed label simply drops
 * the `https://` scheme for readability.
 *
 * Kept as a leaf module (no #/lib/strings/url-helpers import) so its unit
 * tests stay fast and isolated from the lexicon graph.
 */
import {shortenProfilePath} from '#/lib/routes/shortProfile'
import {KRAO_WEB_URL} from '#/env'

function stripLeadingAt(handle: string): string {
  return handle.startsWith('@') ? handle.slice(1) : handle
}

/** Canonical URL - used for QR payload, Share, and Copy. Empty handle -> empty string. */
export function getInviteShareUrl(handle: string): string {
  const bare = stripLeadingAt(handle)
  if (!bare) return ''
  const host = KRAO_WEB_URL.replace(/\/$/, '')
  return `${host}${shortenProfilePath(`/profile/${bare}`)}`
}

/**
 * Human-readable label shown in the "Invite link" field. This is the same
 * canonical URL as getInviteShareUrl with the scheme stripped, so the
 * displayed text always resolves and matches what Copy/Share use.
 */
export function getInviteDisplayUrl(handle: string): string {
  return getInviteShareUrl(handle).replace(/^https?:\/\//, '')
}
