import {
  type InterpretedLabelValueDefinition,
  moderateProfile,
  type ModerationOpts,
} from '@bsky/sdk/moderation'

import {
  IMPERSONATION_LABEL,
  impersonationDefinition,
  isImpersonationLabel,
  withImpersonationDefinition,
} from '../impersonation'

const LABELER = 'did:plc:kraolabeler'
const ACCOUNT = 'did:plc:fake'

function opts(
  labelDefs: Record<string, InterpretedLabelValueDefinition[]>,
  labels: Record<string, 'ignore' | 'warn' | 'hide'> = {},
): ModerationOpts {
  return {
    userDid: 'did:plc:me',
    prefs: {
      adultContentEnabled: false,
      labels: {},
      labelers: [{did: LABELER, labels}],
      mutedWords: [],
      hiddenPosts: [],
    },
    labelDefs,
  }
}

const profile = {
  did: ACCOUNT,
  handle: 'fake.test',
  labels: [
    {
      src: LABELER,
      uri: ACCOUNT,
      val: IMPERSONATION_LABEL,
      cts: '2026-10-17T00:00:00.000Z',
    },
  ],
} as unknown as Parameters<typeof moderateProfile>[0]

describe('impersonation label definition', () => {
  it('has English and Vietnamese strings', () => {
    const def = impersonationDefinition(LABELER)
    expect(def.locales.map(l => l.lang)).toEqual(['en', 'vi'])
    expect(def.locales.find(l => l.lang === 'vi')?.name).toBe('Có thể mạo danh')
    expect(def.definedBy).toBe(LABELER)
  })

  it('informs on the profile and in lists, and hides or blurs nothing', () => {
    const defs = withImpersonationDefinition({}, LABELER)
    const decision = moderateProfile(profile, opts(defs))
    for (const context of [
      'profileView',
      'profileList',
      'contentList',
    ] as const) {
      const ui = decision.ui(context)
      expect(ui.informs).toHaveLength(1)
      expect(ui.filter).toBe(false)
      expect(ui.blur).toBe(false)
      expect(ui.noOverride).toBe(false)
    }
    expect(decision.ui('avatar').blur).toBe(false)
    expect(decision.ui('displayName').blur).toBe(false)
  })

  it('shows nothing when the viewer turned the label off', () => {
    const defs = withImpersonationDefinition({}, LABELER)
    const decision = moderateProfile(
      profile,
      opts(defs, {[IMPERSONATION_LABEL]: 'ignore'}),
    )
    expect(decision.ui('profileView').informs).toHaveLength(0)
  })

  it('shows nothing without the definition (what the app had before)', () => {
    const decision = moderateProfile(profile, opts({}))
    expect(decision.ui('profileView').informs).toHaveLength(0)
  })
})

describe('withImpersonationDefinition', () => {
  it('adds the definition next to the labeler own definitions', () => {
    const other = impersonationDefinition(LABELER)
    const existing = {...other, identifier: 'spam'}
    const out = withImpersonationDefinition({[LABELER]: [existing]}, LABELER)
    expect(out[LABELER].map(d => d.identifier)).toEqual([
      'spam',
      IMPERSONATION_LABEL,
    ])
  })

  it('keeps the definition the labeler publishes', () => {
    const own = {
      ...impersonationDefinition(LABELER),
      severity: 'alert' as const,
    }
    const input = {[LABELER]: [own]}
    expect(withImpersonationDefinition(input, LABELER)).toBe(input)
  })

  it('does not touch other labelers or run without a Krao labeler', () => {
    const input = {'did:plc:other': []}
    expect(withImpersonationDefinition(input, '')).toBe(input)
    const out = withImpersonationDefinition(input, LABELER)
    expect(out['did:plc:other']).toBe(input['did:plc:other'])
    expect(input).toEqual({'did:plc:other': []})
  })
})

describe('isImpersonationLabel', () => {
  it('only counts the value from the Krao labeler', () => {
    expect(
      isImpersonationLabel({val: IMPERSONATION_LABEL, src: LABELER}, LABELER),
    ).toBe(true)
    expect(
      isImpersonationLabel({val: IMPERSONATION_LABEL, src: ACCOUNT}, LABELER),
    ).toBe(false)
    expect(isImpersonationLabel({val: 'spam', src: LABELER}, LABELER)).toBe(
      false,
    )
    expect(isImpersonationLabel({val: IMPERSONATION_LABEL, src: ''}, '')).toBe(
      false,
    )
  })
})
