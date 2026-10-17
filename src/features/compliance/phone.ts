import {getErrorName} from '#/lib/xrpc-error'

/*
 * Phone numbers. Krao's rewards service verifies one number per account
 * (Decree 147), and answers with these error names.
 */

const E164_RE = /^\+[1-9]\d{6,14}$/

/**
 * A number in E.164 form, or null. Mirrors the rewards service, which
 * normalizes again: spaces, dots, dashes and brackets are dropped; 00 stands
 * for +; a Vietnamese national number (0 and 9 digits) gets +84, and so does
 * a +84 number written with its leading 0.
 */
export function normalizePhone(raw: string): string | null {
  let phone = raw.trim().replace(/[\s.\-()]/g, '')
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`
  if (/^0\d{9}$/.test(phone)) phone = `+84${phone.slice(1)}`
  if (phone.startsWith('+840')) phone = `+84${phone.slice(4)}`
  return E164_RE.test(phone) ? phone : null
}

/** +84912345678 -> +84 91 234 5678, as typed back to the user */
export function formatPhone(phone: string): string {
  const vn = /^\+84(\d{2})(\d{3})(\d{4})$/.exec(phone)
  return vn ? `+84 ${vn[1]} ${vn[2]} ${vn[3]}` : phone
}

export type PhoneErrorCode =
  | 'InvalidPhone'
  | 'PhoneTaken'
  | 'PhoneNotSupported'
  | 'PhoneUnavailable'
  | 'SmsFailed'
  | 'InvalidCode'
  | 'CodeExpired'
  | 'TooManyAttempts'
  | 'RateLimited'
  | 'Other'

const KNOWN: ReadonlySet<string> = new Set([
  'InvalidPhone',
  'PhoneTaken',
  'PhoneNotSupported',
  'PhoneUnavailable',
  'SmsFailed',
  'InvalidCode',
  'CodeExpired',
  'TooManyAttempts',
])

/**
 * What went wrong in a phone verification call. Tolerant on purpose: the
 * service may answer a taken number only when the code is checked, and may
 * limit calls with a 429 that carries no Krao error name.
 */
export function phoneErrorCode(err: unknown): PhoneErrorCode {
  const e = err as {error?: unknown; status?: unknown} | null | undefined
  const name =
    (typeof e?.error === 'string' ? e.error : undefined) ?? getErrorName(err)
  if (name && KNOWN.has(name)) return name as PhoneErrorCode
  if (name === 'RateLimitExceeded' || e?.status === 429) return 'RateLimited'
  return 'Other'
}

/**
 * The PDS and the chat service refuse posts and messages from an account
 * without a verified number with this error.
 */
export function isPhoneVerificationRequired(err: unknown): boolean {
  if (getErrorName(err) === 'PhoneVerificationRequired') return true
  const e = err as {error?: unknown} | null | undefined
  return e?.error === 'PhoneVerificationRequired'
}
