import {getErrorName} from '#/lib/xrpc-error'
import {IS_WEB} from '#/env'
import {showSecretWarning, showUnsafeLinkWarning} from './events'
import {
  getCachedLinkSafety,
  getLinkSafetyWithin,
  isCheckableLink,
} from './links'
import {findSecrets, type SecretKind} from './secrets'

/** Links the user chose to open although they are on the scam list */
const confirmedUnsafe = new Set<string>()

/** How long to wait for a dialog to close before showing the warning anyway */
const MAKE_ROOM_FALLBACK_MS = 600

/**
 * What to run to show the warning when the caller is inside a dialog: closes
 * that dialog first (a dialog from the shell cannot open over another on
 * iOS). A dialog that is already closed never calls back, so the warning
 * also shows after a short wait, once either way.
 */
export function showAfterClosing(
  dialog: {isWithinDialog: boolean; close: (cb?: () => void) => void},
  show: () => void,
) {
  if (!dialog.isWithinDialog) {
    show()
    return
  }
  let shown = false
  const once = () => {
    if (shown) return
    shown = true
    show()
  }
  dialog.close(once)
  setTimeout(once, MAKE_ROOM_FALLBACK_MS)
}

/**
 * On web a link opens in a new tab, which a browser allows only straight
 * after the click. A link that has to be looked up first would lose that, so
 * the tab is opened empty at once and sent to the link when the answer is in.
 */
function openBlankTab(): Window | null {
  if (!IS_WEB || typeof window === 'undefined') return null
  try {
    const tab = window.open('', '_blank')
    // The page it is sent to must not reach back to Krao
    if (tab) tab.opener = null
    return tab
  } catch {
    return null
  }
}

/**
 * Opens a link through `open`, unless Krao's scam list has it: then the user
 * is asked first. A link already known to be fine opens at once; an unknown
 * one waits for the answer for a moment (and opens anyway when there is
 * none, since a lookup that fails must not break links). A link the user
 * already chose to open anyway is not asked about again.
 *
 * With `aheadTab` (callers that open the link itself, on web), `open` gets
 * the tab opened ahead, if any, to send to the link.
 * `showWarning` runs what shows the warning, for callers that need to make
 * room for it first (see showAfterClosing).
 */
export function openLinkIfSafe(
  url: string,
  open: (tab?: Window | null) => void,
  showWarning: (show: () => void) => void = show => show(),
  {aheadTab = false}: {aheadTab?: boolean} = {},
) {
  if (!isCheckableLink(url) || confirmedUnsafe.has(url)) {
    open()
    return
  }
  const settle = (
    result: ReturnType<typeof getCachedLinkSafety>,
    tab?: Window | null,
  ) => {
    if (result?.unsafe) {
      tab?.close()
      showWarning(() =>
        showUnsafeLinkWarning({
          url,
          result,
          proceed: () => {
            confirmedUnsafe.add(url)
            open()
          },
        }),
      )
    } else {
      open(tab)
    }
  }
  const cached = getCachedLinkSafety(url)
  if (cached) {
    settle(cached)
    return
  }
  const tab = aheadTab ? openBlankTab() : null
  void getLinkSafetyWithin(url).then(result => settle(result, tab))
}

/** Forgets the links the user chose to open anyway (tests) */
export function clearConfirmedLinks() {
  confirmedUnsafe.clear()
}

/** The kinds of wallet secrets found in any of `texts` */
export function findSecretKinds(...texts: string[]): SecretKind[] {
  const kinds = new Set<SecretKind>()
  for (const text of texts) {
    for (const kind of findSecrets(text)) kinds.add(kind)
  }
  return [...kinds]
}

/** Whether any of `texts` holds a seed phrase or private key */
export function containsSecret(...texts: string[]): boolean {
  return findSecretKinds(...texts).length > 0
}

/**
 * Whether any of `texts` holds a seed phrase or private key. If so, tells
 * the user with a dialog, and the caller must not send. Only for callers
 * that are not inside a sheet of their own (a dialog opened from the shell
 * cannot show over one on iOS): those use containsSecret and say it inline.
 */
export function blockIfSecret(...texts: string[]): boolean {
  const kinds = findSecretKinds(...texts)
  if (!kinds.length) return false
  showSecretWarning(kinds)
  return true
}

/** The chat service refuses a message that holds a seed phrase or private key */
export function isSensitiveSecretError(err: unknown): boolean {
  if (getErrorName(err) === 'SensitiveSecret') return true
  const e = err as {error?: unknown} | null | undefined
  return e?.error === 'SensitiveSecret'
}
