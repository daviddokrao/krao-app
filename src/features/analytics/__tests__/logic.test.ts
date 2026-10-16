import {describe, expect, it} from '@jest/globals'

import {
  buildFunnelRows,
  cohortDate,
  formatPercent,
  funnelPeriod,
  percent,
  retentionCell,
  sortCohorts,
} from '../logic'

describe('percent', () => {
  it('rounds to one decimal', () => {
    expect(percent(1, 3)).toBe(33.3)
    expect(percent(2, 3)).toBe(66.7)
    expect(percent(50, 200)).toBe(25)
    expect(percent(200, 200)).toBe(100)
  })
  it('is 0 without a whole', () => {
    expect(percent(5, 0)).toBe(0)
    expect(percent(0, 0)).toBe(0)
    expect(percent(5, -1)).toBe(0)
    expect(percent(NaN, 10)).toBe(0)
  })
  it('does not cap', () => {
    expect(percent(30, 20)).toBe(150)
  })
})

describe('formatPercent', () => {
  it('drops a trailing .0', () => {
    expect(formatPercent(40)).toBe('40%')
    expect(formatPercent(33.3)).toBe('33.3%')
    expect(formatPercent(0)).toBe('0%')
  })
})

describe('buildFunnelRows', () => {
  it('computes the share of the start and of the previous step', () => {
    const rows = buildFunnelRows([
      {id: 'registered', count: 200},
      {id: 'phoneVerified', count: 100},
      {id: 'kycApproved', count: 40},
      {id: 'walletLinked', count: 20},
      {id: 'firstTip', count: 5},
    ])
    expect(rows.map(r => r.id)).toEqual([
      'registered',
      'phoneVerified',
      'kycApproved',
      'walletLinked',
      'firstTip',
    ])
    expect(rows.map(r => r.ofStart)).toEqual([100, 50, 20, 10, 2.5])
    expect(rows.map(r => r.ofPrevious)).toEqual([100, 50, 40, 50, 25])
    expect(rows.map(r => r.bar)).toEqual([100, 50, 20, 10, 2.5])
  })
  it('puts steps in order whatever order they come in, and fills gaps', () => {
    const rows = buildFunnelRows([
      {id: 'firstTip', count: 1},
      {id: 'registered', count: 10},
    ])
    expect(rows.map(r => r.count)).toEqual([10, 0, 0, 0, 1])
    expect(rows[1].ofPrevious).toBe(0)
    // A step after an empty one has nothing to compare with
    expect(rows[4].ofPrevious).toBe(0)
    expect(rows[4].ofStart).toBe(10)
  })
  it('survives no data and caps the bar', () => {
    const empty = buildFunnelRows([])
    expect(empty.every(r => r.count === 0 && r.bar === 0)).toBe(true)
    expect(empty[0].ofPrevious).toBe(0)
    const over = buildFunnelRows([
      {id: 'registered', count: 10},
      {id: 'walletLinked', count: 15},
    ])
    expect(over[3].ofStart).toBe(150)
    expect(over[3].bar).toBe(100)
  })
  it('ignores unknown ids and bad counts', () => {
    const rows = buildFunnelRows([
      {id: 'registered', count: 10},
      {id: 'mystery' as never, count: 99},
      {id: 'phoneVerified', count: -3},
    ])
    expect(rows.map(r => r.count)).toEqual([10, 0, 0, 0, 0])
  })
})

describe('retentionCell', () => {
  const cohort = {week: '2026-10-05', size: 40, d1: 20, d7: 10}
  it('gives the count and its share of the cohort', () => {
    expect(retentionCell(cohort, 'd1')).toEqual({count: 20, percent: 50})
    expect(retentionCell(cohort, 'd7')).toEqual({count: 10, percent: 25})
  })
  it('is undefined while the day is not observed', () => {
    expect(retentionCell(cohort, 'd30')).toBeUndefined()
  })
  it('keeps a real zero', () => {
    expect(retentionCell({...cohort, d30: 0}, 'd30')).toEqual({
      count: 0,
      percent: 0,
    })
  })
  it('does not divide by an empty cohort', () => {
    expect(retentionCell({week: 'w', size: 0, d1: 0}, 'd1')).toEqual({
      count: 0,
      percent: 0,
    })
  })
})

describe('sortCohorts', () => {
  it('lists the newest week first without changing the input', () => {
    const input = [
      {week: '2026-09-28', size: 1},
      {week: '2026-10-12', size: 3},
      {week: '2026-10-05', size: 2},
    ]
    expect(sortCohorts(input).map(c => c.week)).toEqual([
      '2026-10-12',
      '2026-10-05',
      '2026-09-28',
    ])
    expect(input[0].week).toBe('2026-09-28')
  })
})

describe('funnelPeriod', () => {
  it('goes back the number of days of the range', () => {
    const now = new Date('2026-10-16T00:00:00.000Z')
    expect(funnelPeriod('30d', now)).toEqual({
      since: '2026-09-16T00:00:00.000Z',
      until: '2026-10-16T00:00:00.000Z',
    })
    expect(funnelPeriod('7d', now).since).toBe('2026-10-09T00:00:00.000Z')
  })
})

describe('cohortDate', () => {
  it('is the same calendar day in UTC', () => {
    expect(cohortDate('2026-10-05').toISOString().slice(0, 10)).toBe(
      '2026-10-05',
    )
  })
})
