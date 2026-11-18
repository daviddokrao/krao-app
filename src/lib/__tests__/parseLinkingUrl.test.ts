import {describe, expect, it} from '@jest/globals'

import {BRAND} from '#/lib/brand'
import {parseLinkingUrl} from '../parseLinkingUrl'

describe('parseLinkingUrl', () => {
  it('should correctly parse bluesky:// URLs', () => {
    const url =
      'bluesky://intent/age-assurance?result=success&actorDid=did:example:123'
    const urlp = parseLinkingUrl(url)
    expect(urlp.protocol).toBe('bluesky:')
    expect(urlp.host).toBe('')
    expect(urlp.pathname).toBe('/intent/age-assurance')
  })

  it(`should correctly parse ${BRAND.app.scheme}:// URLs`, () => {
    const urlp = parseLinkingUrl(`${BRAND.app.scheme}://intent/compose?text=gm`)
    expect(urlp.protocol).toBe('krao:')
    expect(urlp.host).toBe('')
    expect(urlp.pathname).toBe('/intent/compose')
    expect(urlp.searchParams.get('text')).toBe('gm')
  })

  it(`should leave ${BRAND.app.scheme}:/// URLs as they are`, () => {
    const urlp = parseLinkingUrl(`${BRAND.app.scheme}:///intent/compose`)
    expect(urlp.pathname).toBe('/intent/compose')
  })

  it('should correctly parse standard URLs', () => {
    const url =
      'https://bsky.app/intent/age-assurance?result=success&actorDid=did:example:123'
    const urlp = parseLinkingUrl(url)
    expect(urlp.protocol).toBe('https:')
    expect(urlp.host).toBe('bsky.app')
    expect(urlp.pathname).toBe('/intent/age-assurance')
  })
})
