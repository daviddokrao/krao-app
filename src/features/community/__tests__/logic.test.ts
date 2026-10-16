import {describe, expect, it} from '@jest/globals'

import {
  buildAccess,
  canModerate,
  type CommunityDraft,
  communityPath,
  getMembershipAction,
  isOwner,
  isValidSlug,
  joinPrivacyNotice,
  makeCommunityUri,
  parseCommunityUri,
  parseRules,
  slugify,
  toReasonKey,
  validateCommunityDraft,
} from '../logic'

const draft = (patch: Partial<CommunityDraft> = {}): CommunityDraft => ({
  name: 'Krao Fans',
  slug: 'krao-fans',
  rulesText: '',
  mode: 'open',
  conditions: [],
  match: 'all',
  chatJoinLink: '',
  ...patch,
})

describe('slugs', () => {
  it('accepts a-z, 0-9 and dashes, 3 to 40 long', () => {
    expect(isValidSlug('abc')).toBe(true)
    expect(isValidSlug('a-b-9')).toBe(true)
    expect(isValidSlug('ab')).toBe(false)
    expect(isValidSlug('a'.repeat(41))).toBe(false)
    expect(isValidSlug('Abc')).toBe(false)
    expect(isValidSlug('a_b')).toBe(false)
  })

  it('makes a slug from a name, with Vietnamese accents removed', () => {
    expect(slugify('Krao Fans!')).toBe('krao-fans')
    expect(slugify('  Cộng đồng Đà Nẵng ')).toBe('cong-dong-da-nang')
    expect(slugify('---')).toBe('')
    expect(isValidSlug(slugify('x'.repeat(80)))).toBe(true)
  })
})

describe('community uris and paths', () => {
  it('round trips', () => {
    const uri = makeCommunityUri('did:plc:abc', 'krao-fans')
    expect(uri).toBe('at://did:plc:abc/net.krao.community.profile/krao-fans')
    expect(parseCommunityUri(uri)).toEqual({
      owner: 'did:plc:abc',
      slug: 'krao-fans',
    })
    expect(communityPath(uri)).toBe('/community/did:plc:abc/krao-fans')
  })

  it('rejects other collections', () => {
    expect(
      parseCommunityUri('at://did:plc:abc/app.bsky.feed.post/3k'),
    ).toBeUndefined()
    expect(parseCommunityUri('nonsense')).toBeUndefined()
    expect(communityPath('nonsense')).toBe('/communities')
  })
})

describe('getMembershipAction', () => {
  it('offers nothing when signed out or banned', () => {
    expect(getMembershipAction('open', undefined, false)).toBe('none')
    expect(getMembershipAction('open', {state: 'banned'}, true)).toBe('none')
  })

  it('joins an open community and asks to join an approval one', () => {
    expect(getMembershipAction('open', {state: 'none'}, true)).toBe('join')
    expect(getMembershipAction('approval', {state: 'none'}, true)).toBe(
      'request',
    )
  })

  it('cannot join when the indexer says the viewer does not qualify', () => {
    expect(
      getMembershipAction(
        'condition',
        {state: 'none', eligible: false, reason: 'NoWallet'},
        true,
      ),
    ).toBe('cannotJoin')
  })

  it('lets members leave, but never the owner', () => {
    expect(
      getMembershipAction('open', {state: 'member', role: 'member'}, true),
    ).toBe('leave')
    expect(
      getMembershipAction('open', {state: 'member', role: 'owner'}, true),
    ).toBe('none')
  })

  it('lets a pending request be withdrawn and an ineligible member leave', () => {
    expect(getMembershipAction('approval', {state: 'pending'}, true)).toBe(
      'cancelRequest',
    )
    expect(getMembershipAction('condition', {state: 'ineligible'}, true)).toBe(
      'leave',
    )
  })
})

describe('roles', () => {
  it('lets owners and moderators moderate', () => {
    expect(canModerate({state: 'member', role: 'owner'})).toBe(true)
    expect(canModerate({state: 'member', role: 'moderator'})).toBe(true)
    expect(canModerate({state: 'member', role: 'member'})).toBe(false)
    expect(canModerate({state: 'banned', role: 'moderator'})).toBe(false)
    expect(canModerate(undefined)).toBe(false)
    expect(isOwner({state: 'member', role: 'owner'})).toBe(true)
    expect(isOwner({state: 'member', role: 'moderator'})).toBe(false)
  })
})

describe('validateCommunityDraft', () => {
  it('accepts a simple draft', () => {
    expect(validateCommunityDraft(draft(), {isNew: true})).toEqual([])
  })

  it('needs a name and, for a new community, a valid slug', () => {
    expect(validateCommunityDraft(draft({name: ' '}), {isNew: true})).toContain(
      'name',
    )
    expect(
      validateCommunityDraft(draft({slug: 'No'}), {isNew: true}),
    ).toContain('slug')
    // The slug of an existing community is not checked
    expect(validateCommunityDraft(draft({slug: 'No'}), {isNew: false})).toEqual(
      [],
    )
  })

  it('limits the rules', () => {
    const tooMany = Array.from({length: 11}, (_, i) => `rule ${i}`).join('\n')
    expect(
      validateCommunityDraft(draft({rulesText: tooMany}), {isNew: true}),
    ).toContain('rules')
    expect(
      validateCommunityDraft(draft({rulesText: 'x'.repeat(301)}), {
        isNew: true,
      }),
    ).toContain('rules')
  })

  it('needs a condition for holder communities and an http chat link', () => {
    expect(
      validateCommunityDraft(draft({mode: 'condition'}), {isNew: true}),
    ).toContain('conditions')
    expect(
      validateCommunityDraft(draft({chatJoinLink: 'ftp://x'}), {isNew: true}),
    ).toContain('chatLink')
    expect(
      validateCommunityDraft(draft({chatJoinLink: 'https://x.co/a'}), {
        isNew: true,
      }),
    ).toEqual([])
  })
})

describe('buildAccess', () => {
  it('carries no conditions unless the mode is condition', () => {
    expect(buildAccess(draft({mode: 'approval'}))).toEqual({mode: 'approval'})
  })

  it('keeps the $type of each condition', () => {
    const nft = {
      $type: 'net.krao.gate.defs#nftHolding' as const,
      chain: 'eip155:8453',
      contract: '0x' + 'a'.repeat(40),
    }
    expect(
      buildAccess(draft({mode: 'condition', conditions: [nft], match: 'any'})),
    ).toEqual({mode: 'condition', conditions: [nft], match: 'any'})
  })
})

describe('parseRules and notices', () => {
  it('trims lines and drops empty ones', () => {
    expect(parseRules(' a \n\n b\n  \n')).toEqual(['a', 'b'])
  })

  it('warns before joining verified and holder communities only', () => {
    expect(joinPrivacyNotice('verified')).toBe('verified')
    expect(joinPrivacyNotice('condition')).toBe('condition')
    expect(joinPrivacyNotice('open')).toBeUndefined()
    expect(joinPrivacyNotice('approval')).toBeUndefined()
  })

  it('maps reason codes', () => {
    expect(toReasonKey('NoWallet')).toBe('NoWallet')
    expect(toReasonKey('whatever')).toBe('other')
    expect(toReasonKey(undefined)).toBe('other')
  })
})
