import {device} from '#/storage'

/*
 * The consent asked for at sign-up: Krao's terms and privacy policy, and the
 * processing of the phone number, identity verification (KYC) and wallet
 * data. The rewards service keeps a record per version. The account does not
 * exist yet when the box is ticked, so the consent waits on the device until
 * the new account's session can record it (see ComplianceHost).
 */

/** Bump when the terms or privacy policy change */
export const CONSENT_VERSION = '2026-10-16'

export type ConsentItem = 'terms' | 'privacy' | 'kyc' | 'phone' | 'wallet'

export const CONSENT_TERMS: ConsentItem[] = ['terms', 'privacy']
export const CONSENT_DATA: ConsentItem[] = ['kyc', 'phone', 'wallet']

/** A consent that is not recorded within this time is dropped */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export function setPendingConsent(
  items: ConsentItem[] = [...CONSENT_TERMS, ...CONSENT_DATA],
) {
  device.set(['kraoPendingConsent'], {
    version: CONSENT_VERSION,
    items,
    savedAt: Date.now(),
  })
}

export function clearPendingConsent() {
  device.set(['kraoPendingConsent'], undefined)
}

export function getPendingConsent():
  {version: string; items: ConsentItem[]} | undefined {
  const pending = device.get(['kraoPendingConsent'])
  if (!pending || Date.now() - pending.savedAt > MAX_AGE_MS) return undefined
  return {version: pending.version, items: pending.items as ConsentItem[]}
}
