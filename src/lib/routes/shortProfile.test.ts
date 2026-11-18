import {describe, expect, it} from '@jest/globals'

import {BRAND} from '#/lib/brand'
import {
  expandProfilePath,
  getReservedPaths,
  shortenProfilePath,
} from './shortProfile'

describe('shortenProfilePath', () => {
  it('drops the Krao handle domain', () => {
    expect(shortenProfilePath(`/profile/lan.${BRAND.domain}`)).toBe('/lan')
    expect(shortenProfilePath(`/profile/lan.${BRAND.domain}/post/3abc`)).toBe(
      '/lan/post/3abc',
    )
    expect(shortenProfilePath(`/profile/lan.${BRAND.domain}/followers`)).toBe(
      '/lan/followers',
    )
  })

  it('keeps the query string', () => {
    expect(shortenProfilePath(`/profile/lan.${BRAND.domain}?tab=media`)).toBe(
      '/lan?tab=media',
    )
  })

  it('keeps custom domain handles whole', () => {
    expect(shortenProfilePath('/profile/lan.example.com/post/3abc')).toBe(
      '/lan.example.com/post/3abc',
    )
  })

  it('leaves DIDs under /profile', () => {
    expect(shortenProfilePath('/profile/did:plc:abc/post/3abc')).toBe(
      '/profile/did:plc:abc/post/3abc',
    )
  })

  it('leaves names that clash with app pages under /profile', () => {
    expect(shortenProfilePath(`/profile/search.${BRAND.domain}`)).toBe(
      `/profile/search.${BRAND.domain}`,
    )
    expect(shortenProfilePath(`/profile/settings.${BRAND.domain}/post/x`)).toBe(
      `/profile/settings.${BRAND.domain}/post/x`,
    )
  })

  it('leaves other paths alone', () => {
    expect(shortenProfilePath('/search?q=x')).toBe('/search?q=x')
    expect(shortenProfilePath('/')).toBe('/')
  })
})

describe('expandProfilePath', () => {
  it('adds the Krao handle domain to a bare name', () => {
    expect(expandProfilePath('/lan')).toBe(`/profile/lan.${BRAND.domain}`)
    expect(expandProfilePath('/Lan/post/3abc')).toBe(
      `/profile/lan.${BRAND.domain}/post/3abc`,
    )
    expect(expandProfilePath('lan/followers')).toBe(
      `/profile/lan.${BRAND.domain}/followers`,
    )
  })

  it('maps full handles and DIDs onto /profile', () => {
    expect(expandProfilePath('/lan.example.com/post/3abc')).toBe(
      '/profile/lan.example.com/post/3abc',
    )
    expect(expandProfilePath('/did:plc:abc')).toBe('/profile/did:plc:abc')
  })

  it('leaves app pages alone', () => {
    for (const path of [
      '/',
      '/search',
      '/settings/account',
      '/messages/abc',
      `/profile/lan.${BRAND.domain}`,
      '/hashtag/web3',
      '/starter-pack/lan/3abc',
      '/intent/compose',
      '/chat/abcdefg',
      '/download',
    ]) {
      expect(expandProfilePath(path)).toBe(path)
    }
  })

  it('round-trips with shortenProfilePath', () => {
    for (const path of [
      `/profile/lan.${BRAND.domain}/post/3abc`,
      '/profile/lan.example.com',
      '/profile/did:plc:abc/lists/3xyz',
    ]) {
      expect(expandProfilePath(shortenProfilePath(path))).toBe(path)
    }
  })
})

describe('getReservedPaths', () => {
  it('includes every top-level app page', () => {
    const reserved = getReservedPaths()
    for (const name of ['search', 'settings', 'messages', 'profile', 'saved']) {
      expect(reserved.has(name)).toBe(true)
    }
  })
})
