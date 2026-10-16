import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

const mockStore = new Map<string, unknown>()

jest.mock('#/storage', () => ({
  device: {
    get: (key: string[]) => mockStore.get(key.join('.')),
    set: (key: string[], value: unknown) => mockStore.set(key.join('.'), value),
  },
}))

import {
  clearPendingConsent,
  CONSENT_VERSION,
  getPendingConsent,
  setPendingConsent,
} from '../consent'

describe('pending consent', () => {
  let now = 1_700_000_000_000

  beforeEach(() => {
    mockStore.clear()
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('keeps what was agreed to until it is recorded', () => {
    expect(getPendingConsent()).toBeUndefined()
    setPendingConsent()
    expect(getPendingConsent()).toEqual({
      version: CONSENT_VERSION,
      items: ['terms', 'privacy', 'kyc', 'phone', 'wallet'],
    })
    clearPendingConsent()
    expect(getPendingConsent()).toBeUndefined()
  })

  it('drops a consent that was never recorded', () => {
    setPendingConsent()
    now += 25 * 60 * 60 * 1000
    expect(getPendingConsent()).toBeUndefined()
  })
})
