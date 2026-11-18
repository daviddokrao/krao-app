/*
 * Deferred deep link for referral codes: a code that came with the install,
 * not with a krao.net/join/<code> link opened in the app. Android carries it
 * in the Play Install Referrer (`krao_code=<code>`); iOS has no such thing,
 * so the code is read from the clipboard, after asking the user.
 */

/** The shape of a code (same as the rewards service accepts) */
const CODE_RE = /^[A-Z0-9-]{3,32}$/

export function isReferralCodeShape(text: string | null | undefined) {
  return !!text && CODE_RE.test(text.trim().toUpperCase())
}

/**
 * The code from a Play Install Referrer string, which is a query string
 * ("utm_source=x&krao_code=ABC123"); undefined when it has none or the value
 * is not shaped like a code.
 */
export function parseInstallReferrer(
  referrer: string | null | undefined,
): string | undefined {
  if (!referrer) return undefined
  for (const pair of referrer.replace(/^\?/, '').split('&')) {
    const eq = pair.indexOf('=')
    if (eq < 0 || pair.slice(0, eq) !== 'krao_code') continue
    let value = pair.slice(eq + 1)
    try {
      value = decodeURIComponent(value.replace(/\+/g, ' '))
    } catch {
      return undefined
    }
    return isReferralCodeShape(value) ? value.trim().toUpperCase() : undefined
  }
  return undefined
}

/**
 * The code from clipboard text: either the bare code or a krao.net
 * /join/<code> link. Anything else (a long text, another link) is not ours
 * and is ignored.
 */
export function parseClipboardCode(
  text: string | null | undefined,
): string | undefined {
  const trimmed = text?.trim()
  if (!trimmed || trimmed.length > 200) return undefined
  const link =
    /^(?:https?:\/\/)?[^/\s]+\/join\/([^/?#\s]+)\/?(?:[?#]\S*)?$/i.exec(trimmed)
  const candidate = link ? link[1] : trimmed
  return isReferralCodeShape(candidate) ? candidate.toUpperCase() : undefined
}
