import {describe, expect, it} from '@jest/globals'

import {getInviteDisplayUrl, getInviteShareUrl} from './urls'

describe('invite URLs', () => {
  describe('getInviteShareUrl', () => {
    it('returns the short profile URL for a Krao handle', () => {
      expect(getInviteShareUrl('alice.krao.net')).toBe('https://krao.net/alice')
    })

    it('keeps the full handle for custom domains', () => {
      expect(getInviteShareUrl('thepope.dev')).toBe(
        'https://krao.net/thepope.dev',
      )
    })

    it('strips a leading @ if present', () => {
      expect(getInviteShareUrl('@alice.krao.net')).toBe(
        'https://krao.net/alice',
      )
    })

    it('passes the handle through verbatim (handles are API-normalized, like makeProfileLink)', () => {
      expect(getInviteShareUrl('Alice.Example.com')).toBe(
        'https://krao.net/Alice.Example.com',
      )
    })

    it('keeps the long form for a handle that names an app page', () => {
      expect(getInviteShareUrl('search.krao.net')).toBe(
        'https://krao.net/profile/search.krao.net',
      )
    })

    it('returns empty string for empty handle (EDGE-001)', () => {
      expect(getInviteShareUrl('')).toBe('')
      expect(getInviteShareUrl('@')).toBe('')
    })
  })

  describe('getInviteDisplayUrl', () => {
    it('returns the scheme-stripped short profile URL', () => {
      expect(getInviteDisplayUrl('danielle.krao.net')).toBe('krao.net/danielle')
    })

    it('uses the long form when the handle has no dot', () => {
      expect(getInviteDisplayUrl('alice')).toBe('krao.net/profile/alice')
    })

    it('strips a leading @ if present', () => {
      expect(getInviteDisplayUrl('@alice.krao.net')).toBe('krao.net/alice')
    })

    it('returns empty string for empty handle (EDGE-001)', () => {
      expect(getInviteDisplayUrl('')).toBe('')
      expect(getInviteDisplayUrl('@')).toBe('')
    })

    it('mirrors getInviteShareUrl exactly minus the scheme', () => {
      expect(getInviteDisplayUrl('alice.example.com')).toBe(
        getInviteShareUrl('alice.example.com').replace(/^https:\/\//, ''),
      )
    })
  })
})
