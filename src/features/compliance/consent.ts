import {device} from '#/storage'

/*
 * The consent asked for at sign-up: Krao's terms and privacy policy, and the
 * processing of the phone number, identity verification (KYC) and wallet
 * data. The rewards service keeps a record per version. The account does not
 * exist yet when the box is ticked, so the consent waits on the device, tied
 * to the handle being created, until that account's session can record it
 * (see ComplianceHost). Any other account, one made before consent was asked
 * for, or one that has not agreed to the current version, is asked in
 * ConsentGate.
 */

/** Bump when the terms or privacy policy change */
export const CONSENT_VERSION = '2026-10-16'

export type ConsentItem = 'terms' | 'privacy' | 'kyc' | 'phone' | 'wallet'

export const CONSENT_TERMS: ConsentItem[] = ['terms', 'privacy']
export const CONSENT_DATA: ConsentItem[] = ['kyc', 'phone', 'wallet']

/** A consent that is not recorded within this time is dropped */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export function setPendingConsent(
  handle: string,
  items: ConsentItem[] = [...CONSENT_TERMS, ...CONSENT_DATA],
) {
  device.set(['kraoPendingConsent'], {
    handle: handle.toLowerCase(),
    version: CONSENT_VERSION,
    items,
    savedAt: Date.now(),
  })
}

export function clearPendingConsent() {
  device.set(['kraoPendingConsent'], undefined)
}

/** What was agreed to at sign-up as `handle`, if not recorded yet */
export function getPendingConsent(
  handle: string | undefined,
): {version: string; items: ConsentItem[]} | undefined {
  const pending = device.get(['kraoPendingConsent'])
  if (
    !pending ||
    !handle ||
    pending.handle !== handle.toLowerCase() ||
    Date.now() - pending.savedAt > MAX_AGE_MS
  ) {
    return undefined
  }
  return {version: pending.version, items: pending.items as ConsentItem[]}
}

/**
 * Whether an account still has to agree: it has no consent record for the
 * current version (versions are dates, so they compare as text) or the record
 * lacks something the current version asks for.
 */
export function needsConsent(
  consents: {version: string; items: string[]}[] | undefined,
): boolean {
  if (!consents) return false
  const required = [...CONSENT_TERMS, ...CONSENT_DATA]
  return !consents.some(
    c =>
      c.version >= CONSENT_VERSION && required.every(i => c.items.includes(i)),
  )
}
