import {
  formatRank,
  formatWeekRange,
  lastMomentOfPeriod,
  LEADERBOARD_TIME_ZONE,
} from '../format'

/** Formats like i18n.date would, in English */
const fmt = (d: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', options).format(d)

/** The week of Fri Oct 16 2026 as the backend reports it (Sun 17:00 UTC) */
const WEEK = {
  start: '2026-10-11T17:00:00.000Z',
  end: '2026-10-18T17:00:00.000Z',
}

describe('formatWeekRange', () => {
  const tz = process.env.TZ
  afterEach(() => {
    process.env.TZ = tz
  })

  it('shows Monday to Sunday in Vietnam, not in the device zone', () => {
    process.env.TZ = 'Asia/Dubai'
    expect(formatWeekRange(WEEK, fmt)).toBe('Oct 12 - Oct 18, 2026')
    process.env.TZ = 'America/Los_Angeles'
    expect(formatWeekRange(WEEK, fmt)).toBe('Oct 12 - Oct 18, 2026')
  })

  it('formats every date in Asia/Ho_Chi_Minh', () => {
    const zones: (string | undefined)[] = []
    formatWeekRange(WEEK, (d, options) => {
      zones.push(options.timeZone)
      return fmt(d, options)
    })
    expect(zones).toEqual([LEADERBOARD_TIME_ZONE, LEADERBOARD_TIME_ZONE])
  })

  it('handles a period that crosses a year', () => {
    expect(
      formatWeekRange(
        {start: '2026-12-27T17:00:00.000Z', end: '2027-01-03T17:00:00.000Z'},
        fmt,
      ),
    ).toBe('Dec 28 - Jan 3, 2027')
  })

  it('returns undefined for bad dates', () => {
    expect(formatWeekRange({start: 'x', end: 'y'}, fmt)).toBeUndefined()
  })

  it('does not go backwards', () => {
    const end = new Date(WEEK.start)
    expect(lastMomentOfPeriod(end).getTime()).toBe(end.getTime() - 1)
    expect(formatWeekRange({start: WEEK.start, end: WEEK.start}, fmt)).toBe(
      'Oct 12, 2026',
    )
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
