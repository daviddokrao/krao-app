import {describe, expect, it} from '@jest/globals'

import {
  CHECKLIST_STEPS,
  detectSteps,
  FOLLOW_TARGET,
  isChecklistComplete,
  isNewAccount,
  mergeDone,
  NEW_ACCOUNT_DAYS,
  shouldShowChecklist,
} from '../steps'

describe('detectSteps', () => {
  it('has nothing done for an empty account', () => {
    expect(detectSteps({})).toEqual(new Set())
    expect(
      detectSteps({followsCount: 0, postsCount: 0, wallets: [], badges: []}),
    ).toEqual(new Set())
  })

  it('detects an avatar', () => {
    expect(detectSteps({avatar: 'https://cdn.example/a.jpg'})).toEqual(
      new Set(['avatar']),
    )
  })

  it('needs five follows', () => {
    expect(detectSteps({followsCount: FOLLOW_TARGET - 1}).has('follow')).toBe(
      false,
    )
    expect(detectSteps({followsCount: FOLLOW_TARGET}).has('follow')).toBe(true)
    expect(detectSteps({followsCount: 40}).has('follow')).toBe(true)
  })

  it('needs one post', () => {
    expect(detectSteps({postsCount: 0}).has('post')).toBe(false)
    expect(detectSteps({postsCount: 1}).has('post')).toBe(true)
  })

  it('counts a verified or pending wallet but not an invalid one', () => {
    expect(detectSteps({wallets: [{status: 'verified'}]}).has('wallet')).toBe(
      true,
    )
    expect(detectSteps({wallets: [{status: 'pending'}]}).has('wallet')).toBe(
      true,
    )
    expect(detectSteps({wallets: [{status: 'invalid'}]}).has('wallet')).toBe(
      false,
    )
    expect(
      detectSteps({wallets: [{status: 'invalid'}, {status: 'verified'}]}).has(
        'wallet',
      ),
    ).toBe(true)
  })

  it('detects a first tip from the tipper badge', () => {
    expect(detectSteps({badges: [{id: 'supported'}]}).has('tip')).toBe(false)
    expect(
      detectSteps({badges: [{id: 'wallet-verified'}, {id: 'tipper'}]}).has(
        'tip',
      ),
    ).toBe(true)
  })

  it('detects everything', () => {
    const done = detectSteps({
      avatar: 'https://cdn.example/a.jpg',
      followsCount: 7,
      postsCount: 3,
      wallets: [{status: 'verified'}],
      badges: [{id: 'tipper'}],
    })
    expect([...done].sort()).toEqual([...CHECKLIST_STEPS].sort())
  })
})

describe('mergeDone', () => {
  it('keeps steps done earlier even when the data no longer shows them', () => {
    expect(mergeDone({done: ['avatar', 'post']}, new Set(['follow']))).toEqual([
      'avatar',
      'follow',
      'post',
    ])
  })

  it('returns steps in checklist order without duplicates', () => {
    expect(
      mergeDone({done: ['tip', 'avatar']}, new Set(['avatar', 'wallet'])),
    ).toEqual(['avatar', 'wallet', 'tip'])
  })

  it('ignores unknown stored steps and missing state', () => {
    expect(mergeDone({done: ['bogus' as never, 'post']}, new Set())).toEqual([
      'post',
    ])
    expect(mergeDone(undefined, new Set(['avatar']))).toEqual(['avatar'])
  })
})

describe('isNewAccount', () => {
  const now = Date.parse('2026-10-16T12:00:00Z')
  const daysAgo = (n: number) => new Date(now - n * 86400e3).toISOString()

  it('is true within the first 30 days', () => {
    expect(isNewAccount(daysAgo(0), now)).toBe(true)
    expect(isNewAccount(daysAgo(NEW_ACCOUNT_DAYS - 1), now)).toBe(true)
  })

  it('is false afterwards', () => {
    expect(isNewAccount(daysAgo(NEW_ACCOUNT_DAYS), now)).toBe(false)
    expect(isNewAccount(daysAgo(400), now)).toBe(false)
  })

  it('is false when the creation date is unknown or invalid', () => {
    expect(isNewAccount(undefined, now)).toBe(false)
    expect(isNewAccount('yesterday', now)).toBe(false)
  })
})

describe('shouldShowChecklist', () => {
  const base = {
    ready: true,
    dismissed: false,
    newAccount: true,
    done: ['avatar' as const],
  }

  it('shows for a new account that has steps left', () => {
    expect(shouldShowChecklist(base)).toBe(true)
  })

  it('hides while loading, once dismissed, or for older accounts', () => {
    expect(shouldShowChecklist({...base, ready: false})).toBe(false)
    expect(shouldShowChecklist({...base, dismissed: true})).toBe(false)
    expect(shouldShowChecklist({...base, newAccount: false})).toBe(false)
  })

  it('hides when every step is done', () => {
    expect(isChecklistComplete([...CHECKLIST_STEPS])).toBe(true)
    expect(shouldShowChecklist({...base, done: [...CHECKLIST_STEPS]})).toBe(
      false,
    )
  })
})
