/*
 * Cashtags ($ETH) are detected in the text when a post is rendered, not stored
 * as facets, and only the symbols in the indexer's token catalog become links.
 */

/**
 * `$` followed by 2-10 letters or digits, the first one a letter. The
 * boundaries match the indexer's (any letter or digit, so `é$ETH` and `$ETHé`
 * are not cashtags), so a linked cashtag is one the token's feed lists.
 */
const CASHTAG =
  /(^|[^\p{L}\p{N}_$&])\$([A-Za-z][A-Za-z0-9]{1,9})(?![\p{L}\p{N}_])/gu

export type TextPart = {text: string; symbol?: undefined} | CashtagPart
export type CashtagPart = {
  /** What was typed, e.g. `$eth` */
  text: string
  /** Upper case, e.g. `ETH` */
  symbol: string
}

/** Upper case, without a leading `$` (a `/token/$eth` URL works too) */
export function normalizeSymbol(symbol: string): string {
  return symbol.trim().replace(/^\$/, '').toUpperCase()
}

export function hasCashtag(text: string): boolean {
  CASHTAG.lastIndex = 0
  const found = CASHTAG.test(text)
  CASHTAG.lastIndex = 0
  return found
}

/**
 * Cuts `text` into plain parts and the cashtags that `isKnown` accepts. A
 * cashtag the catalog does not have stays inside the plain text.
 */
export function splitCashtags(
  text: string,
  isKnown: (symbol: string) => boolean,
): TextPart[] {
  const parts: TextPart[] = []
  let plain = ''
  let cursor = 0
  for (const match of text.matchAll(CASHTAG)) {
    const symbol = normalizeSymbol(match[2])
    if (!isKnown(symbol)) continue
    const start = match.index + match[1].length
    plain += text.slice(cursor, start)
    if (plain) parts.push({text: plain})
    plain = ''
    parts.push({text: `$${match[2]}`, symbol})
    cursor = start + 1 + match[2].length
  }
  plain += text.slice(cursor)
  if (plain) parts.push({text: plain})
  return parts
}

/** The symbol of a search query that is exactly one cashtag, else undefined */
export function parseCashtagQuery(query: string): string | undefined {
  const match = /^\s*\$([A-Za-z][A-Za-z0-9]{1,9})\s*$/.exec(query)
  return match ? normalizeSymbol(match[1]) : undefined
}

export function tokenPath(symbol: string): string {
  return `/token/${encodeURIComponent(normalizeSymbol(symbol))}`
}

function toNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * A price in US dollars: two decimals from $1 up, and four significant
 * digits below it so that small prices don't collapse to $0.00.
 */
export function formatUsd(
  value: string | number | undefined | null,
  locale = 'en-US',
): string | null {
  const n = toNumber(value)
  if (n === null) return null
  const abs = Math.abs(n)
  const maxFraction =
    abs === 0 || abs >= 1 ? 2 : Math.min(12, 3 - Math.floor(Math.log10(abs)))
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFraction,
  }).format(n)
}

export type Direction = 'up' | 'down' | 'flat'

/** A change that rounds to 0.00% counts as flat */
export function changeDirection(
  value: string | number | undefined | null,
): Direction | null {
  const n = toNumber(value)
  if (n === null) return null
  const rounded = Math.round(n * 100) / 100
  return rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat'
}

/** A signed percentage such as +2.34% or -0.50% */
export function formatPercent(
  value: string | number | undefined | null,
): string | null {
  const n = toNumber(value)
  if (n === null) return null
  const rounded = Math.round(n * 100) / 100
  const text = Math.abs(rounded).toFixed(2)
  return `${rounded > 0 ? '+' : rounded < 0 ? '-' : ''}${text}%`
}

/** Only https URLs are shown as a logo, as the indexer only accepts those */
export function safeLogoUri(logo: string | undefined): string | undefined {
  return logo && /^https:\/\/\S+$/i.test(logo) ? logo : undefined
}

export type PricePoint = {t: number | string; priceUsd: string | number}

/**
 * The points as an SVG path in a `width` x `height` box, or undefined when
 * there is nothing to draw. Time sets the x position when every point has a
 * parseable one, otherwise the points are spread evenly.
 */
export function buildChartPath(
  points: PricePoint[],
  width: number,
  height: number,
  pad = 4,
): string | undefined {
  const prices = points.map(p => toNumber(p.priceUsd))
  const times = points.map(p =>
    typeof p.t === 'number' ? p.t : Date.parse(p.t),
  )
  const valid = prices.flatMap((price, i) =>
    price === null ? [] : [{price, time: times[i], i}],
  )
  if (valid.length < 2 || width <= 0 || height <= 0) return undefined
  const byTime = valid.every(v => Number.isFinite(v.time))
  const xs = valid.map(v => (byTime ? v.time : v.i))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const min = Math.min(...valid.map(v => v.price))
  const max = Math.max(...valid.map(v => v.price))
  const spanX = maxX - minX || 1
  const spanY = max - min
  return valid
    .map((v, k) => {
      const x = pad + ((xs[k] - minX) / spanX) * (width - pad * 2)
      const y =
        spanY === 0
          ? height / 2
          : pad + (1 - (v.price - min) / spanY) * (height - pad * 2)
      return `${k === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}
