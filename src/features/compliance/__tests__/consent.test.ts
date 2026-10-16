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
  needsConsent,
  setPendingConsent,
} from '../consent'

const ALL = ['terms', 'privacy', 'kyc', 'phone', 'wallet']

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
    expect(getPendingConsent('lan.krao.net')).toBeUndefined()
    setPendingConsent('lan.krao.net')
    expect(getPendingConsent('lan.krao.net')).toEqual({
      version: CONSENT_VERSION,
      items: ALL,
    })
    clearPendingConsent()
    expect(getPendingConsent('lan.krao.net')).toBeUndefined()
  })

  it('belongs to the account being created, not to the device', () => {
    setPendingConsent('Lan.Krao.net')
    expect(getPendingConsent('lan.krao.net')).toBeDefined()
    expect(getPendingConsent('someone-else.krao.net')).toBeUndefined()
    expect(getPendingConsent(undefined)).toBeUndefined()
  })

  it('ignores a consent saved before it was tied to a handle', () => {
    mockStore.set('kraoPendingConsent', {
      version: CONSENT_VERSION,
      items: ALL,
      savedAt: now,
    })
    expect(getPendingConsent('lan.krao.net')).toBeUndefined()
  })

  it('drops a consent that was never recorded', () => {
    setPendingConsent('lan.krao.net')
    now += 25 * 60 * 60 * 1000
    expect(getPendingConsent('lan.krao.net')).toBeUndefined()
  })
})

describe('needsConsent', () => {
  it('does not ask before the records are known', () => {
    expect(needsConsent(undefined)).toBe(false)
  })

  it('asks an account with no record (made before consent was asked for)', () => {
    expect(needsConsent([])).toBe(true)
  })

  it('is satisfied by a record of the current version with every item', () => {
    expect(needsConsent([{version: CONSENT_VERSION, items: ALL}])).toBe(false)
    expect(needsConsent([{version: '2099-01-01', items: ALL}])).toBe(false)
  })

  it('asks again when the terms changed, or the record is missing an item', () => {
    expect(needsConsent([{version: '2026-01-01', items: ALL}])).toBe(true)
    expect(
      needsConsent([{version: CONSENT_VERSION, items: ['terms', 'privacy']}]),
    ).toBe(true)
  })

  it('looks at every record, not only the first', () => {
    expect(
      needsConsent([
        {version: '2026-01-01', items: ALL},
        {version: CONSENT_VERSION, items: ALL},
      ]),
    ).toBe(false)
  })
})
