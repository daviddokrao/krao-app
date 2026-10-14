import {
  applyKraoServiceDids,
  KRAO_SERVICES_CONFIG,
  resolveKraoServiceDids,
} from '#/lib/constants'
import {device} from '#/storage'

/**
 * Sets up the Discover feed and labeler DIDs before the app renders. Only the
 * first start waits for the handles to resolve: after that the DIDs from the
 * last start are used right away and refreshed in the background, for the
 * next start.
 */
export async function initKraoServices() {
  const cached = device.get(['kraoServiceDids'])
  const refresh = resolveKraoServiceDids().then(dids => {
    if (dids.complete) {
      device.set(['kraoServiceDids'], {
        config: KRAO_SERVICES_CONFIG,
        feedOwnerDid: dids.feedOwnerDid,
        labelerDid: dids.labelerDid,
      })
    }
    return dids
  })
  if (cached?.config === KRAO_SERVICES_CONFIG) {
    applyKraoServiceDids(cached)
    void refresh.catch(() => {})
    return
  }
  applyKraoServiceDids(await refresh)
}
