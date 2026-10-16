const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The last day of a week that ends at `end`. The backend's `end` is the
 * start of the next week, so a boundary at 00:00 UTC belongs to the day
 * before.
 */
export function lastDayOfPeriod(end: Date): Date {
  return end.getTime() % DAY_MS === 0 ? new Date(end.getTime() - 1) : end
}

/**
 * "Oct 12 - Oct 18, 2026", from the period the leaderboard reports.
 * `formatDate` formats one date (eg from i18n.date); undefined for dates
 * that do not parse.
 */
export function formatWeekRange(
  period: {start: string; end: string},
  formatDate: (d: Date, part: 'short' | 'long') => string,
): string | undefined {
  const start = new Date(period.start)
  const end = new Date(period.end)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined
  }
  const last = lastDayOfPeriod(end)
  if (last.getTime() < start.getTime()) return formatDate(start, 'long')
  return `${formatDate(start, 'short')} - ${formatDate(last, 'long')}`
}

/** "#4", or a dash for someone not on the board */
export function formatRank(rank: number | undefined): string {
  return rank !== undefined && Number.isInteger(rank) && rank > 0
    ? `#${rank}`
    : '-'
}
