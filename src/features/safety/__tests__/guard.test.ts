import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

import {showSecretWarning} from '../events'
import {
  blockIfSecret,
  containsSecret,
  isSensitiveSecretError,
  showAfterClosing,
} from '../guard'

jest.mock('../events', () => ({
  showUnsafeLinkWarning: jest.fn(),
  showSecretWarning: jest.fn(),
}))

const PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const KEY = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

beforeEach(() => {
  jest.mocked(showSecretWarning).mockClear()
})

describe('blockIfSecret', () => {
  it('blocks a seed phrase and says so', () => {
    expect(blockIfSecret(`my wallet: ${PHRASE}`)).toBe(true)
    expect(showSecretWarning).toHaveBeenCalledWith(['seedPhrase'])
  })

  it('blocks a private key, and names both when a thread has both', () => {
    expect(blockIfSecret('gm', `private key: ${KEY}`, PHRASE)).toBe(true)
    expect(showSecretWarning).toHaveBeenCalledWith(['privateKey', 'seedPhrase'])
  })

  it('lets ordinary messages through, with no warning', () => {
    expect(blockIfSecret('xin chao', `tx 0x${KEY}`)).toBe(false)
    expect(blockIfSecret(`https://tronscan.org/#/transaction/${KEY}`)).toBe(
      false,
    )
    expect(showSecretWarning).not.toHaveBeenCalled()
  })
})

describe('isSensitiveSecretError', () => {
  it('recognizes the chat service refusal', () => {
    expect(isSensitiveSecretError({error: 'SensitiveSecret'})).toBe(true)
    expect(isSensitiveSecretError({error: 'InvalidRequest'})).toBe(false)
    expect(isSensitiveSecretError(new Error('x'))).toBe(false)
    expect(isSensitiveSecretError(undefined)).toBe(false)
  })
})

describe('containsSecret', () => {
  it('says so without opening a dialog (for callers inside a sheet)', () => {
    expect(containsSecret(PHRASE)).toBe(true)
    expect(containsSecret('gm', `private key: ${KEY}`)).toBe(true)
    expect(containsSecret('gm', 'tx 0x' + KEY)).toBe(false)
    expect(showSecretWarning).not.toHaveBeenCalled()
  })
})

describe('showAfterClosing', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows at once when not inside a dialog', () => {
    const show = jest.fn()
    const close = jest.fn()
    showAfterClosing({isWithinDialog: false, close}, show)
    expect(show).toHaveBeenCalledTimes(1)
    expect(close).not.toHaveBeenCalled()
  })

  it('shows once the dialog it is in has closed', () => {
    const show = jest.fn()
    const close = jest.fn((cb?: () => void) => cb?.())
    showAfterClosing({isWithinDialog: true, close}, show)
    jest.advanceTimersByTime(2000)
    expect(show).toHaveBeenCalledTimes(1)
  })

  it('still shows when the dialog was already closed and never calls back', () => {
    const show = jest.fn()
    const close = jest.fn()
    showAfterClosing({isWithinDialog: true, close}, show)
    expect(show).not.toHaveBeenCalled()
    jest.advanceTimersByTime(2000)
    expect(show).toHaveBeenCalledTimes(1)
  })
})
