import {IS_WEB, KRAO_WEB_URL} from '#/env'

/** The origins of Krao's own web app: no Mini App may run on any of them */
export function hostOrigins(): string[] {
  const origins: string[] = []
  try {
    origins.push(new URL(KRAO_WEB_URL).origin)
  } catch {
    // An unusable setting adds nothing
  }
  if (IS_WEB && typeof window !== 'undefined') {
    origins.push(window.location.origin)
  }
  return origins
}
