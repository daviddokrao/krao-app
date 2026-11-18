import {describe, expect, it} from '@jest/globals'

import {
  formatPhone,
  isPhoneVerificationRequired,
  normalizePhone,
  phoneErrorCode,
} from '../phone'

describe('normalizePhone', () => {
  it('turns Vietnamese national numbers into E.164', () => {
    expect(normalizePhone('0912345678')).toBe('+84912345678')
    expect(normalizePhone('091 234 5678')).toBe('+84912345678')
    expect(normalizePhone('0912.345.678')).toBe('+84912345678')
    expect(normalizePhone('+84 (0)91-234-5678')).toBe('+84912345678')
    expect(normalizePhone('+84912345678')).toBe('+84912345678')
    expect(normalizePhone('0084912345678')).toBe('+84912345678')
  })

  it('keeps E.164 numbers of other countries', () => {
    expect(normalizePhone('+1 415 555 0100')).toBe('+14155550100')
  })

  it('rejects what is not a phone number', () => {
    for (const bad of [
      '',
      '   ',
      '12345',
      '84912345678',
      '+0123456789',
      'abc',
      '+8491234567890123',
      '091234567',
    ]) {
      expect(normalizePhone(bad)).toBeNull()
    }
  })

  it('formats Vietnamese numbers for display', () => {
    expect(formatPhone('+84912345678')).toBe('+84 91 234 5678')
    expect(formatPhone('+14155550100')).toBe('+14155550100')
  })
})

describe('phoneErrorCode', () => {
  it('names the errors the rewards service declares', () => {
    for (const error of [
      'InvalidPhone',
      'PhoneTaken',
      'PhoneNotSupported',
      'PhoneUnavailable',
      'SmsFailed',
      'InvalidCode',
      'CodeExpired',
      'TooManyAttempts',
    ]) {
      expect(phoneErrorCode({error})).toBe(error)
    }
  })

  it('treats any 429 as a rate limit, whatever the name', () => {
    expect(phoneErrorCode({error: 'RateLimitExceeded', status: 429})).toBe(
      'RateLimited',
    )
    expect(phoneErrorCode({error: undefined, status: 429})).toBe('RateLimited')
  })

  it('falls back for anything else, so the UI always has words', () => {
    expect(phoneErrorCode(new Error('Failed to fetch'))).toBe('Other')
    expect(phoneErrorCode({error: 'Whatever', status: 500})).toBe('Other')
    expect(phoneErrorCode(undefined)).toBe('Other')
  })
})

describe('isPhoneVerificationRequired', () => {
  it('recognizes the PDS and chat refusal', () => {
    expect(
      isPhoneVerificationRequired({error: 'PhoneVerificationRequired'}),
    ).toBe(true)
    expect(isPhoneVerificationRequired({error: 'InvalidRequest'})).toBe(false)
    expect(isPhoneVerificationRequired(new Error('x'))).toBe(false)
    expect(isPhoneVerificationRequired(null)).toBe(false)
  })
})
