import {displayPrimaryName, shortAddress} from '../primaryName'

describe('displayPrimaryName', () => {
  it('leaves short names alone', () => {
    expect(displayPrimaryName('alice.base.eth')).toBe('alice.base.eth')
    expect(displayPrimaryName('vitalik.eth')).toBe('vitalik.eth')
  })
  it('shortens the first label and keeps the ending', () => {
    const out = displayPrimaryName('averyveryveryverylongname.base.eth', 20)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out.endsWith('….base.eth')).toBe(true)
    expect(out.startsWith('avery')).toBe(true)
  })
  it('cuts the whole name when the ending leaves no room', () => {
    const out = displayPrimaryName('a.some-very-long-ending-here', 12)
    expect(out.length).toBe(12)
    expect(out.endsWith('…')).toBe(true)
  })
  it('handles names without a dot', () => {
    expect(displayPrimaryName('x'.repeat(40), 10)).toBe(`${'x'.repeat(9)}…`)
  })
})

describe('shortAddress', () => {
  it('shortens an EVM address', () => {
    expect(shortAddress('0xAbCdEf0123456789aBcDeF0123456789abcdef01')).toBe(
      '0xAbCd...ef01',
    )
  })
  it('leaves anything else', () => {
    expect(shortAddress('eip155:8453:0x1')).toBe('eip155:8453:0x1')
  })
})
