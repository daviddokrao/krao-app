import {Client} from '@atproto/lex'

import {device} from '#/storage'

/**
 * Moderation authorities that apply in specific countries, on top of the app
 * labeler. Bluesky's regional labelers do not apply to Krao, which has none of
 * its own yet.
 */
const MODERATION_AUTHORITIES: {
  [countryCode: string]: string[]
} = {}

const MODERATION_AUTHORITIES_DIDS = Array.from(
  new Set(Object.values(MODERATION_AUTHORITIES).flat()),
)

export function isNonConfigurableModerationAuthority(did: string) {
  return MODERATION_AUTHORITIES_DIDS.includes(did)
}

export function configureAdditionalModerationAuthorities() {
  const geolocation = device.get(['mergedGeolocation'])
  // default to all
  let additionalLabelers: string[] = MODERATION_AUTHORITIES_DIDS

  if (geolocation?.countryCode) {
    // overwrite with only those necessary
    additionalLabelers = MODERATION_AUTHORITIES[geolocation.countryCode] ?? []
  }

  if (__DEV__) {
    additionalLabelers = []
  }

  /*
   * Merge with whatever is already on the static rather than replacing it, so
   * `switchToKraoAppLabeler`'s entry survives.
   */
  const appLabelers = Array.from(
    new Set<string>([...Client.appLabelers, ...additionalLabelers]),
  )

  configureGlobalAppLabelers(appLabelers)
}

/**
 * Set the global app labelers on the lex `Client` static, which every client
 * reads, so a request carries the same `;redact` authorities whether or not
 * there is a session behind it.
 *
 * It is a single global producer by design. The PDS client opts out with
 * `appLabelers: null` (see `clients.ts`) because that service takes no
 * moderation authorities. Appview and chat requests each carry one copy from
 * their respective clients.
 */
export function configureGlobalAppLabelers(dids: string[]) {
  Client.configure({appLabelers: dids as `did:${string}:${string}`[]})
}
