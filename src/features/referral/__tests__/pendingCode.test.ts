import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

const mockStore = new Map<string, unknown>()

jest.mock('#/storage', () => ({
  device: {
    get: (key: string[]) => mockStore.get(key.join('.')),
    set: (key: string[], value: unknown) => mockStore.set(key.join('.'), value),
  },
}))

import {getPendingReferralCode, setPendingReferralCode} from '../pendingCode'

const DAY = 24 * 60 * 60 * 1000

describe('pending referral code', () => {
  let now = 1_700_000_000_000

  beforeEach(() => {
    mockStore.clear()
    now = 1_700_000_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('is empty when nothing is stored', () => {
    expect(getPendingReferralCode()).toBe('')
  })

  it('trims and uppercases the code', () => {
    setPendingReferralCode('  abc123 ')
    expect(getPendingReferralCode()).toBe('ABC123')
  })

  it('overwrites an earlier code', () => {
    setPendingReferralCode('first')
    setPendingReferralCode('second')
    expect(getPendingReferralCode()).toBe('SECOND')
  })

  it('returns the code up to 7 days old', () => {
    setPendingReferralCode('abc')
    now += 7 * DAY
    expect(getPendingReferralCode()).toBe('ABC')
  })

  it('expires the code after 7 days', () => {
    setPendingReferralCode('abc')
    now += 7 * DAY + 1
    expect(getPendingReferralCode()).toBe('')
  })
})
