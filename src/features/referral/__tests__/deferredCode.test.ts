import {
  isReferralCodeShape,
  parseClipboardCode,
  parseInstallReferrer,
} from '../deferredCode'

describe('parseInstallReferrer', () => {
  it('reads krao_code from a query string', () => {
    expect(parseInstallReferrer('krao_code=abc123')).toBe('ABC123')
    expect(parseInstallReferrer('utm_source=web&krao_code=ABC-123&x=1')).toBe(
      'ABC-123',
    )
    expect(parseInstallReferrer('?krao_code=K7K7K7K7')).toBe('K7K7K7K7')
  })
  it('decodes the value', () => {
    expect(parseInstallReferrer('krao_code=AB%2DCD')).toBe('AB-CD')
  })
  it('ignores a missing, malformed or odd-shaped code', () => {
    expect(parseInstallReferrer(undefined)).toBeUndefined()
    expect(parseInstallReferrer('')).toBeUndefined()
    expect(parseInstallReferrer('utm_source=google-play')).toBeUndefined()
    expect(parseInstallReferrer('krao_code=')).toBeUndefined()
    expect(parseInstallReferrer('krao_code=ab')).toBeUndefined()
    expect(parseInstallReferrer('krao_code=a b c')).toBeUndefined()
    expect(parseInstallReferrer('krao_code=%E0%A4%A')).toBeUndefined()
    expect(parseInstallReferrer('other_krao_code=ABC123')).toBeUndefined()
  })
})

describe('parseClipboardCode', () => {
  it('accepts a bare code', () => {
    expect(parseClipboardCode('abc123')).toBe('ABC123')
    expect(parseClipboardCode('  K7K7K7K7\n')).toBe('K7K7K7K7')
  })
  it('accepts a join link', () => {
    expect(parseClipboardCode('https://krao.net/join/abc123')).toBe('ABC123')
    expect(parseClipboardCode('krao.net/join/abc123/')).toBe('ABC123')
    expect(parseClipboardCode('https://krao.net/join/abc123?x=1')).toBe(
      'ABC123',
    )
  })
  it('ignores other clipboard content', () => {
    expect(parseClipboardCode('hello world')).toBeUndefined()
    expect(parseClipboardCode('https://example.com/page')).toBeUndefined()
    expect(parseClipboardCode('x'.repeat(500))).toBeUndefined()
    expect(parseClipboardCode('')).toBeUndefined()
    expect(parseClipboardCode(null)).toBeUndefined()
  })
})

describe('isReferralCodeShape', () => {
  it('matches the rewards service format', () => {
    expect(isReferralCodeShape('ABC')).toBe(true)
    expect(isReferralCodeShape('ab')).toBe(false)
    expect(isReferralCodeShape('A'.repeat(33))).toBe(false)
    expect(isReferralCodeShape('AB_CD')).toBe(false)
  })
})
