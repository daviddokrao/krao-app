import {describe, expect, it} from '@jest/globals'

import {
  buildChartPath,
  changeDirection,
  formatPercent,
  formatUsd,
  hasCashtag,
  normalizeSymbol,
  parseCashtagQuery,
  safeLogoUri,
  splitCashtags,
  tokenPath,
} from '../logic'

const known = (...symbols: string[]) => {
  const set = new Set(symbols)
  return (s: string) => set.has(s)
}

describe('hasCashtag', () => {
  it('finds a cashtag', () => {
    expect(hasCashtag('buying $ETH today')).toBe(true)
    expect(hasCashtag('$eth')).toBe(true)
    expect(hasCashtag('($AERO)')).toBe(true)
    expect(hasCashtag('a $B2B b')).toBe(true)
  })

  it('ignores amounts, one-letter and too-long symbols', () => {
    expect(hasCashtag('it costs $100')).toBe(false)
    expect(hasCashtag('$5 and $1a')).toBe(false)
    expect(hasCashtag('$A')).toBe(false)
    expect(hasCashtag('$ABCDEFGHIJK')).toBe(false)
    expect(hasCashtag('US$ETH or a$ETH')).toBe(false)
    expect(hasCashtag('$$ETH')).toBe(false)
    expect(hasCashtag('plain text')).toBe(false)
  })

  it('is stable across calls', () => {
    expect(hasCashtag('$ETH')).toBe(true)
    expect(hasCashtag('$ETH')).toBe(true)
  })
})

describe('splitCashtags', () => {
  it('links only known symbols, in upper case', () => {
    expect(splitCashtags('hi $eth and $nope!', known('ETH'))).toEqual([
      {text: 'hi '},
      {text: '$eth', symbol: 'ETH'},
      {text: ' and $nope!'},
    ])
  })

  it('handles cashtags at the edges and back to back', () => {
    expect(splitCashtags('$ETH $AERO', known('ETH', 'AERO'))).toEqual([
      {text: '$ETH', symbol: 'ETH'},
      {text: ' '},
      {text: '$AERO', symbol: 'AERO'},
    ])
  })

  it('keeps punctuation around the symbol', () => {
    expect(splitCashtags('($ETH).', known('ETH'))).toEqual([
      {text: '('},
      {text: '$ETH', symbol: 'ETH'},
      {text: ').'},
    ])
  })

  it('returns the text whole when nothing is known', () => {
    expect(splitCashtags('$ETH', known())).toEqual([{text: '$ETH'}])
    expect(splitCashtags('', known('ETH'))).toEqual([])
  })

  it('does not match inside a longer word', () => {
    expect(splitCashtags('x$ETH $ETHER', known('ETH'))).toEqual([
      {text: 'x$ETH $ETHER'},
    ])
  })

  it('treats accented letters as letters, like the indexer', () => {
    expect(splitCashtags('é$ETH $ETHé &$ETH', known('ETH'))).toEqual([
      {text: 'é$ETH $ETHé &$ETH'},
    ])
    expect(splitCashtags('mua $ETH.', known('ETH'))).toEqual([
      {text: 'mua '},
      {text: '$ETH', symbol: 'ETH'},
      {text: '.'},
    ])
  })
})

describe('parseCashtagQuery', () => {
  it('accepts a lone cashtag', () => {
    expect(parseCashtagQuery('$eth')).toBe('ETH')
    expect(parseCashtagQuery('  $AERO ')).toBe('AERO')
  })

  it('rejects anything else', () => {
    expect(parseCashtagQuery('eth')).toBeUndefined()
    expect(parseCashtagQuery('$eth usdc')).toBeUndefined()
    expect(parseCashtagQuery('$1')).toBeUndefined()
    expect(parseCashtagQuery('')).toBeUndefined()
  })
})

describe('tokenPath', () => {
  it('upper-cases and encodes', () => {
    expect(tokenPath('eth')).toBe('/token/ETH')
  })

  it('drops a leading $, as the indexer does', () => {
    expect(tokenPath('$eth')).toBe('/token/ETH')
    expect(normalizeSymbol(' $cbBTC ')).toBe('CBBTC')
  })
})

describe('formatUsd', () => {
  it('uses two decimals from one dollar up', () => {
    expect(formatUsd('3120.5')).toBe('$3,120.50')
    expect(formatUsd(1)).toBe('$1.00')
    expect(formatUsd('0')).toBe('$0.00')
  })

  it('keeps four significant digits for small prices', () => {
    expect(formatUsd('0.5')).toBe('$0.50')
    expect(formatUsd('0.123456')).toBe('$0.1235')
    expect(formatUsd('0.00001234')).toBe('$0.00001234')
  })

  it('gives null for a missing or broken value', () => {
    expect(formatUsd(undefined)).toBeNull()
    expect(formatUsd('')).toBeNull()
    expect(formatUsd('abc')).toBeNull()
  })
})

describe('formatPercent and changeDirection', () => {
  it('signs the value', () => {
    expect(formatPercent('2.346')).toBe('+2.35%')
    expect(formatPercent('-0.5')).toBe('-0.50%')
    expect(formatPercent(0)).toBe('0.00%')
  })

  it('treats a rounded zero as flat', () => {
    expect(formatPercent('0.001')).toBe('0.00%')
    expect(formatPercent('-0.001')).toBe('0.00%')
    expect(changeDirection('0.001')).toBe('flat')
    expect(changeDirection('1.2')).toBe('up')
    expect(changeDirection('-1.2')).toBe('down')
  })

  it('gives null for a missing value', () => {
    expect(formatPercent(undefined)).toBeNull()
    expect(changeDirection('x')).toBeNull()
  })
})

describe('safeLogoUri', () => {
  it('allows only https', () => {
    expect(safeLogoUri('https://x.test/a.png')).toBe('https://x.test/a.png')
    expect(safeLogoUri('http://x.test/a.png')).toBeUndefined()
    expect(safeLogoUri('javascript:alert(1)')).toBeUndefined()
    expect(safeLogoUri(undefined)).toBeUndefined()
  })
})

describe('buildChartPath', () => {
  it('needs two points', () => {
    expect(buildChartPath([{t: 1, priceUsd: '1'}], 100, 50)).toBeUndefined()
    expect(buildChartPath([], 100, 50)).toBeUndefined()
  })

  it('maps low to the bottom and high to the top', () => {
    const path = buildChartPath(
      [
        {t: 0, priceUsd: '1'},
        {t: 10, priceUsd: '3'},
      ],
      108,
      54,
    )
    expect(path).toBe('M4.0 50.0 L104.0 4.0')
  })

  it('draws a flat line in the middle', () => {
    const path = buildChartPath(
      [
        {t: '2026-01-01T00:00:00Z', priceUsd: '2'},
        {t: '2026-01-02T00:00:00Z', priceUsd: '2'},
      ],
      108,
      54,
    )
    expect(path).toBe('M4.0 27.0 L104.0 27.0')
  })
})
