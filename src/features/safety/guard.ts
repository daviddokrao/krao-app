import {getErrorName} from '#/lib/xrpc-error'
import {showSecretWarning, showUnsafeLinkWarning} from './events'
import {
  getCachedLinkSafety,
  getLinkSafetyWithin,
  isCheckableLink,
} from './links'
import {findSecrets, type SecretKind} from './secrets'

/**
 * Opens a link through `open`, unless Krao's scam list has it: then the user
 * is asked first. A link already known to be fine opens at once; an unknown
 * one waits for the answer for a moment (and opens anyway when there is
 * none, since a lookup that fails must not break links).
 *
 * `showWarning` runs what shows the warning, for callers that need to make
 * room for it first (eg close the dialog they are in).
 */
export function openLinkIfSafe(
  url: string,
  open: () => void,
  showWarning: (show: () => void) => void = show => show(),
) {
  if (!isCheckableLink(url)) {
    open()
    return
  }
  const settle = (result: ReturnType<typeof getCachedLinkSafety>) => {
    if (result?.unsafe) {
      showWarning(() => showUnsafeLinkWarning({url, result, proceed: open}))
    } else {
      open()
    }
  }
  const cached = getCachedLinkSafety(url)
  if (cached) {
    settle(cached)
    return
  }
  void getLinkSafetyWithin(url).then(settle)
}

/**
 * Whether any of `texts` holds a seed phrase or private key. If so, tells
 * the user, and the caller must not send.
 */
export function blockIfSecret(...texts: string[]): boolean {
  const kinds = new Set<SecretKind>()
  for (const text of texts) {
    for (const kind of findSecrets(text)) kinds.add(kind)
  }
  if (!kinds.size) return false
  showSecretWarning([...kinds])
  return true
}

/** The chat service refuses a message that holds a seed phrase or private key */
export function isSensitiveSecretError(err: unknown): boolean {
  if (getErrorName(err) === 'SensitiveSecret') return true
  const e = err as {error?: unknown} | null | undefined
  return e?.error === 'SensitiveSecret'
}
