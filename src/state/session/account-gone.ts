import {getErrorName, getErrorStatus} from '#/lib/xrpc-error'

/**
 * Errors that a live account can still get from `getSession`. Expired tokens
 * are refreshed by the session itself, and suspended accounts have their own
 * screens.
 */
const RECOVERABLE_ERRORS = [
  'ExpiredToken',
  'AccountTakedown',
  'AccountDeactivated',
]

/**
 * True when the PDS definitively rejects `getSession` for stored tokens that
 * still verify, which means the account no longer exists on that PDS (it was
 * deleted, or a test server was reset). Network errors and 5xx are not.
 */
export function isAccountGoneError(e: unknown): boolean {
  const status = getErrorStatus(e)
  if (status !== 400 && status !== 401) return false
  const name = getErrorName(e)
  return !name || !RECOVERABLE_ERRORS.includes(name)
}
