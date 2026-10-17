import {describe, expect, it} from '@jest/globals'

import {
  buildPollRecord,
  emptyPollDraft,
  getVoteBlock,
  isPollEnded,
  leadingOptions,
  MAX_DURATION_MS,
  optionShares,
  type PollDraft,
  pollEndsAt,
  timeLeft,
  validatePollDraft,
} from '../logic'

const draft = (patch: Partial<PollDraft> = {}): PollDraft => ({
  ...emptyPollDraft(),
  options: ['Yes', 'No'],
  ...patch,
})

describe('validatePollDraft', () => {
  it('needs two to four filled options', () => {
    expect(validatePollDraft(draft())).toEqual([])
    expect(validatePollDraft(draft({options: ['Yes', ' ']}))).toContain(
      'options',
    )
    expect(validatePollDraft(draft({options: ['a', 'b', 'c', 'd']}))).toEqual(
      [],
    )
    expect(
      validatePollDraft(draft({options: ['a', 'b', 'c', 'd', 'e']})),
    ).toContain('options')
  })

  it('limits the option and question length', () => {
    expect(
      validatePollDraft(draft({options: ['x'.repeat(81), 'b']})),
    ).toContain('optionLength')
    expect(validatePollDraft(draft({question: 'q'.repeat(301)}))).toContain(
      'question',
    )
  })

  it('needs an asset for token polls', () => {
    expect(validatePollDraft(draft({mode: 'token'}))).toContain('asset')
    expect(
      validatePollDraft(draft({mode: 'token', asset: 'eip155:8453/slip44:60'})),
    ).toEqual([])
  })
})

describe('pollEndsAt', () => {
  const now = new Date('2026-10-16T00:00:00.000Z')
  it('adds the duration', () => {
    expect(pollEndsAt(draft({durationHours: 24}), now).toISOString()).toBe(
      '2026-10-17T00:00:00.000Z',
    )
  })
  it('never goes past 30 days', () => {
    const end = pollEndsAt(draft({durationHours: 24 * 365}), now)
    expect(end.getTime() - now.getTime()).toBe(MAX_DURATION_MS)
  })
})

describe('buildPollRecord', () => {
  const now = new Date('2026-10-16T00:00:00.000Z')
  const post = {uri: 'at://did:plc:a/app.bsky.feed.post/3k', cid: 'bafy'}
  const toDatetime = (d: Date) => d.toISOString()

  it('trims options and leaves out an empty question', () => {
    const record = buildPollRecord({
      draft: draft({options: [' Yes ', '', 'No'], question: ' '}),
      post,
      now,
      toDatetime,
    })
    expect(record.options).toEqual(['Yes', 'No'])
    expect(record).not.toHaveProperty('question')
    expect(record).not.toHaveProperty('asset')
    expect(record.post).toEqual(post)
    expect(record.mode).toBe('account')
    expect(record.resultsVisibility).toBe('always')
  })

  it('carries the asset only for token polls', () => {
    const asset = 'eip155:8453/slip44:60'
    const token = buildPollRecord({
      draft: draft({mode: 'token', asset, resultsVisibility: 'afterEnd'}),
      post,
      now,
      toDatetime,
    })
    expect(token.asset).toBe(asset)
    expect(token.resultsVisibility).toBe('afterEnd')
    const verified = buildPollRecord({
      draft: draft({mode: 'verified', asset}),
      post,
      now,
      toDatetime,
    })
    expect(verified).not.toHaveProperty('asset')
  })
})

describe('time', () => {
  const now = new Date('2026-10-16T12:00:00.000Z')
  it('knows when a poll has ended', () => {
    expect(isPollEnded('2026-10-16T11:59:59.000Z', now)).toBe(true)
    expect(isPollEnded('2026-10-16T12:00:00.000Z', now)).toBe(true)
    expect(isPollEnded('2026-10-16T12:00:01.000Z', now)).toBe(false)
  })

  it('shows the largest unit left', () => {
    expect(timeLeft('2026-10-19T13:00:00.000Z', now)).toEqual({
      unit: 'days',
      value: 3,
    })
    expect(timeLeft('2026-10-16T17:30:00.000Z', now)).toEqual({
      unit: 'hours',
      value: 5,
    })
    expect(timeLeft('2026-10-16T12:00:10.000Z', now)).toEqual({
      unit: 'minutes',
      value: 1,
    })
    expect(timeLeft('2026-10-16T11:00:00.000Z', now)).toBeUndefined()
  })
})

describe('optionShares', () => {
  const options = [
    {index: 0, text: 'a', votes: 1, weight: '300'},
    {index: 1, text: 'b', votes: 1, weight: '100'},
    {index: 2, text: 'c', votes: 1, weight: '0'},
  ]

  it('is all zero before any vote', () => {
    const shares = optionShares(
      [
        {index: 0, text: 'a', votes: 0},
        {index: 1, text: 'b', votes: 0},
      ],
      'account',
    )
    expect(shares.map(s => s.percent)).toEqual([0, 0])
  })

  it('splits by vote and sums to 100', () => {
    const shares = optionShares(options, 'account')
    expect(shares.map(s => s.percent)).toEqual([34, 33, 33])
    expect(shares.reduce((sum, s) => sum + s.percent, 0)).toBe(100)
  })

  it('splits token polls by weight, with big numbers', () => {
    const shares = optionShares(options, 'token')
    expect(shares.map(s => s.percent)).toEqual([75, 25, 0])
    const big = optionShares(
      [
        {index: 0, text: 'a', weight: '30000000000000000000000'},
        {index: 1, text: 'b', weight: '10000000000000000000000'},
      ],
      'token',
    )
    expect(big.map(s => s.percent)).toEqual([75, 25])
  })
})

describe('leadingOptions', () => {
  it('returns every option on a tie and none without votes', () => {
    expect(
      leadingOptions(
        [
          {index: 0, votes: 2},
          {index: 1, votes: 2},
          {index: 2, votes: 1},
        ],
        'account',
      ),
    ).toEqual([0, 1])
    expect(leadingOptions([{index: 0, votes: 0}], 'account')).toEqual([])
  })
})

describe('getVoteBlock', () => {
  const base = {
    ended: false,
    hasVoted: false,
    signedIn: true,
    mode: 'account' as const,
    hasWallet: true as boolean | undefined,
  }
  it('lets a signed in viewer vote', () => {
    expect(getVoteBlock(base)).toBeUndefined()
  })
  it('blocks ended polls, repeat votes and signed out viewers', () => {
    expect(getVoteBlock({...base, ended: true})).toBe('ended')
    expect(getVoteBlock({...base, hasVoted: true})).toBe('alreadyVoted')
    expect(getVoteBlock({...base, signedIn: false})).toBe('signedOut')
  })
  it('warns a token poll voter without a wallet, not while loading', () => {
    expect(getVoteBlock({...base, mode: 'token', hasWallet: false})).toBe(
      'needsWallet',
    )
    expect(
      getVoteBlock({...base, mode: 'token', hasWallet: undefined}),
    ).toBeUndefined()
    expect(
      getVoteBlock({...base, mode: 'token', hasWallet: true}),
    ).toBeUndefined()
    expect(
      getVoteBlock({...base, mode: 'verified', hasWallet: false}),
    ).toBeUndefined()
  })
})
