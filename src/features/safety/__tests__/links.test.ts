import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

import {showUnsafeLinkWarning} from '../events'
import {openLinkIfSafe} from '../guard'
import {
  clearLinkSafetyCache,
  getCachedLinkSafety,
  getLinkSafety,
  getLinkSafetyWithin,
  isCheckableLink,
} from '../links'

jest.mock('../events', () => ({
  showUnsafeLinkWarning: jest.fn(),
  showSecretWarning: jest.fn(),
}))

const UNSAFE = 'https://drainer.test/claim'
const SAFE = 'https://example.com/page'

const settle = () => new Promise(resolve => setTimeout(resolve, 50))

/** The indexer: drainer.test is listed, nothing else is */
function mockFetch() {
  const calls: string[][] = []
  const fn = jest.fn((_url: unknown, init?: {body?: unknown}) => {
    const {urls} = JSON.parse(String(init?.body)) as {urls: string[]}
    calls.push(urls)
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          results: urls.map(url => ({
            url,
            unsafe: url.includes('drainer.test'),
            ...(url.includes('drainer.test') ? {domain: 'drainer.test'} : {}),
          })),
        }),
    })
  })
  global.fetch = fn as unknown as typeof fetch
  return {fn, calls}
}

function mockOffline() {
  global.fetch = jest.fn(() => Promise.reject(new Error('offline')))
}

beforeEach(() => {
  clearLinkSafetyCache()
  jest.mocked(showUnsafeLinkWarning).mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('isCheckableLink', () => {
  it('takes web links outside Krao only', () => {
    expect(isCheckableLink(SAFE)).toBe(true)
    expect(isCheckableLink('http://example.com')).toBe(true)
    expect(isCheckableLink('mailto:a@example.com')).toBe(false)
    expect(isCheckableLink('/profile/krao.test')).toBe(false)
    expect(isCheckableLink('https://krao.net/profile/x')).toBe(false)
  })
})

describe('getLinkSafety', () => {
  it('batches links asked about together and remembers the answers', async () => {
    const {calls} = mockFetch()
    const [first, second] = await Promise.all([
      getLinkSafety(UNSAFE),
      getLinkSafety(SAFE),
    ])
    expect(first).toMatchObject({unsafe: true, domain: 'drainer.test'})
    expect(second).toMatchObject({unsafe: false})
    expect(calls).toHaveLength(1)
    expect([...calls[0]].sort()).toEqual([SAFE, UNSAFE].sort())

    // Asked again: from memory
    expect(await getLinkSafety(UNSAFE)).toMatchObject({unsafe: true})
    expect(calls).toHaveLength(1)
    expect(getCachedLinkSafety(SAFE)?.unsafe).toBe(false)
  })

  it('forgets a safe answer after a while, an unsafe one later', async () => {
    mockFetch()
    await getLinkSafety(UNSAFE)
    await getLinkSafety(SAFE)
    const soon = Date.now() + 11 * 60 * 1000
    expect(getCachedLinkSafety(SAFE, soon)).toBeUndefined()
    expect(getCachedLinkSafety(UNSAFE, soon)?.unsafe).toBe(true)
  })

  it('answers undefined, without throwing, when the service fails', async () => {
    mockOffline()
    expect(await getLinkSafety(SAFE)).toBeUndefined()
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({error: 'RateLimitExceeded'}),
      }),
    ) as unknown as typeof fetch
    expect(await getLinkSafety('https://example.org')).toBeUndefined()
  })

  it('does not ask about links outside the web', async () => {
    const {fn} = mockFetch()
    expect(await getLinkSafety('mailto:a@example.com')).toBeUndefined()
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('getLinkSafetyWithin', () => {
  it('gives up after the timeout', async () => {
    jest.useFakeTimers()
    global.fetch = jest.fn(
      () => new Promise(() => {}),
    ) as unknown as typeof fetch
    const pending = getLinkSafetyWithin(SAFE, 1000)
    await jest.advanceTimersByTimeAsync(2000)
    expect(await pending).toBeUndefined()
  })
})

describe('openLinkIfSafe', () => {
  it('opens a safe link', async () => {
    mockFetch()
    const open = jest.fn()
    openLinkIfSafe(SAFE, open)
    await settle()
    expect(open).toHaveBeenCalledTimes(1)
    expect(showUnsafeLinkWarning).not.toHaveBeenCalled()
  })

  it('opens at once what is not a web link', () => {
    const open = jest.fn()
    openLinkIfSafe('mailto:a@example.com', open)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('opens a link whose lookup failed (the list is a safeguard)', async () => {
    mockOffline()
    const open = jest.fn()
    openLinkIfSafe(SAFE, open)
    await settle()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('asks first about a link on the list, and opens it only on request', async () => {
    mockFetch()
    const open = jest.fn()
    const showWarning = jest.fn((show: () => void) => show())
    openLinkIfSafe(UNSAFE, open, showWarning)
    await settle()
    expect(open).not.toHaveBeenCalled()
    expect(showWarning).toHaveBeenCalledTimes(1)
    expect(showUnsafeLinkWarning).toHaveBeenCalledTimes(1)
    const request = jest.mocked(showUnsafeLinkWarning).mock.calls[0][0]
    expect(request.url).toBe(UNSAFE)
    expect(request.result.domain).toBe('drainer.test')
    // "Open anyway"
    request.proceed()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('asks at once, with no lookup, about a link already known', async () => {
    mockFetch()
    await getLinkSafety(UNSAFE)
    const open = jest.fn()
    openLinkIfSafe(UNSAFE, open)
    expect(showUnsafeLinkWarning).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })
})
