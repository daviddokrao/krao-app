import {device} from '#/storage'

/*
 * The referral code from a krao.net/join/<code> link, kept until sign-up
 * uses it. Stored on the device, so it survives a reload on web (the link
 * opens a fresh page load before the sign-up form shows) and an app restart
 * on native (the user may open the link, then come back later to sign up).
 */

/** A code from an old link should not fill in a sign-up weeks later */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function setPendingReferralCode(code: string) {
  device.set(['kraoPendingReferralCode'], {
    code: code.trim().toUpperCase(),
    savedAt: Date.now(),
  })
}

export function getPendingReferralCode(): string {
  const pending = device.get(['kraoPendingReferralCode'])
  if (!pending || Date.now() - pending.savedAt > MAX_AGE_MS) return ''
  return pending.code
}
