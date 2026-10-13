import {logger} from '#/logger'
import {KRAO_SHORT_LINK_URL} from '#/env'

export function useShortenLink() {
  return async (inputUrl: string): Promise<{url: string}> => {
    const url = new URL(inputUrl)
    const res = await fetch(`${KRAO_SHORT_LINK_URL}/link`, {
      method: 'POST',
      body: JSON.stringify({
        path: url.pathname,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      logger.error('Failed to shorten link', {safeMessage: res.status})
      return {url: inputUrl}
    }

    return res.json()
  }
}
