/*
 * Posting and chatting need a verified phone number. Failures are caught in
 * code with no UI of its own (the chat state machine, mutations), so they ask
 * the dialog mounted in the shell to open.
 */

export type PhoneVerificationReason = 'post' | 'chat' | 'welcome'

type Listener = (reason: PhoneVerificationReason) => void

const listeners = new Set<Listener>()

let verifiedAt = 0

/** Opens the "verify your phone number" dialog */
export function openPhoneVerification(reason: PhoneVerificationReason) {
  for (const listener of listeners) listener(reason)
}

export function onPhoneVerificationRequested(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The PDS and the chat service remember "not verified" for about 15 seconds,
 * so just after verifying, a refusal means "wait a moment", not "verify".
 */
export const CACHE_WAIT_MS = 30_000

export function markPhoneVerified() {
  verifiedAt = Date.now()
}

export function justVerifiedPhone(now = Date.now()) {
  return now - verifiedAt < CACHE_WAIT_MS
}
