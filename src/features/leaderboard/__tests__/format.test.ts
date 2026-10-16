import {formatRank, formatWeekRange, lastDayOfPeriod} from '../format'

const fmt = (d: Date, part: 'short' | 'long') =>
  part === 'short'
    ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
    : `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`

describe('formatWeekRange', () => {
  it('shows the last day, not the start of the next week', () => {
    expect(
      formatWeekRange(
        {start: '2026-10-12T00:00:00.000Z', end: '2026-10-19T00:00:00.000Z'},
        fmt,
      ),
    ).toBe('10/12 - 10/18/2026')
  })

  it('keeps an end that is not on a day boundary', () => {
    expect(
      formatWeekRange(
        {start: '2026-10-12T00:00:00.000Z', end: '2026-10-18T12:00:00.000Z'},
        fmt,
      ),
    ).toBe('10/12 - 10/18/2026')
  })

  it('handles a period that crosses a year', () => {
    expect(
      formatWeekRange(
        {start: '2026-12-28T00:00:00.000Z', end: '2027-01-04T00:00:00.000Z'},
        fmt,
      ),
    ).toBe('12/28 - 1/3/2027')
  })

  it('returns undefined for bad dates', () => {
    expect(formatWeekRange({start: 'x', end: 'y'}, fmt)).toBeUndefined()
  })

  it('does not go backwards', () => {
    const end = new Date('2026-10-12T00:00:00.000Z')
    expect(lastDayOfPeriod(end).getTime()).toBe(end.getTime() - 1)
    expect(
      formatWeekRange(
        {start: '2026-10-12T00:00:00.000Z', end: '2026-10-12T00:00:00.000Z'},
        fmt,
      ),
    ).toBe('10/12/2026')
  })
})

describe('formatRank', () => {
  it('formats positive ranks', () => {
    expect(formatRank(1)).toBe('#1')
    expect(formatRank(120)).toBe('#120')
  })
  it('uses a dash for no rank', () => {
    expect(formatRank(undefined)).toBe('-')
    expect(formatRank(0)).toBe('-')
    expect(formatRank(-3)).toBe('-')
    expect(formatRank(1.5)).toBe('-')
  })
})
