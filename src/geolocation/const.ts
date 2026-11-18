import {GEOLOCATION_URL} from '#/env'
import {type Geolocation} from '#/geolocation/types'

/** Unset when no geolocation worker is configured: the fallback applies */
export const GEOLOCATION_SERVICE_URL: string | undefined = GEOLOCATION_URL
  ? `${GEOLOCATION_URL}/geolocation`
  : undefined

/**
 * Default geolocation config.
 */
export const FALLBACK_GEOLOCATION_SERVICE_RESPONSE: Geolocation = {
  countryCode: undefined,
  regionCode: undefined,
  city: undefined,
}
