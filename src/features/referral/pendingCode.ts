import {IS_WEB} from '#/env'

/*
 * The referral code from a krao.net/join/<code> link, kept until sign-up
 * uses it. On web it survives a reload (the link opens a fresh page load
 * before the sign-up form shows).
 */

const KEY = 'krao.pendingReferralCode'
let pending: string | undefined

export function setPendingReferralCode(code: string) {
  pending = code.trim().toUpperCase()
  if (IS_WEB) {
    try {
      window.sessionStorage.setItem(KEY, pending)
    } catch {}
  }
}

export function getPendingReferralCode(): string {
  if (!pending && IS_WEB) {
    try {
      pending = window.sessionStorage.getItem(KEY) ?? undefined
    } catch {}
  }
  return pending ?? ''
}
