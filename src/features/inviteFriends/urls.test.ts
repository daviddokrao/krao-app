import {describe, expect, it} from '@jest/globals'

import {BRAND} from '#/lib/brand'
import {getInviteDisplayUrl, getInviteShareUrl} from './urls'

describe('invite URLs', () => {
  describe('getInviteShareUrl', () => {
    it('returns the short profile URL for a Krao handle', () => {
      expect(getInviteShareUrl(`alice.${BRAND.domain}`)).toBe(
        `https://${BRAND.domain}/alice`,
      )
    })

    it('keeps the full handle for custom domains', () => {
      expect(getInviteShareUrl('thepope.dev')).toBe(
        `https://${BRAND.domain}/thepope.dev`,
      )
    })

    it('strips a leading @ if present', () => {
      expect(getInviteShareUrl(`@alice.${BRAND.domain}`)).toBe(
        `https://${BRAND.domain}/alice`,
      )
    })

    it('passes the handle through verbatim (handles are API-normalized, like makeProfileLink)', () => {
      expect(getInviteShareUrl('Alice.Example.com')).toBe(
        `https://${BRAND.domain}/Alice.Example.com`,
      )
    })

    it('keeps the long form for a handle that names an app page', () => {
      expect(getInviteShareUrl(`search.${BRAND.domain}`)).toBe(
        `https://${BRAND.domain}/profile/search.${BRAND.domain}`,
      )
    })

    it('returns empty string for empty handle (EDGE-001)', () => {
      expect(getInviteShareUrl('')).toBe('')
      expect(getInviteShareUrl('@')).toBe('')
    })
  })

  describe('getInviteDisplayUrl', () => {
    it('returns the scheme-stripped short profile URL', () => {
      expect(getInviteDisplayUrl(`danielle.${BRAND.domain}`)).toBe(
        `${BRAND.domain}/danielle`,
      )
    })

    it('uses the long form when the handle has no dot', () => {
      expect(getInviteDisplayUrl('alice')).toBe(`${BRAND.domain}/profile/alice`)
    })

    it('strips a leading @ if present', () => {
      expect(getInviteDisplayUrl(`@alice.${BRAND.domain}`)).toBe(
        `${BRAND.domain}/alice`,
      )
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
