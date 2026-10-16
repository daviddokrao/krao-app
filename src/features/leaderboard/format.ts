/**
 * The leaderboard's weeks are ISO weeks in Vietnam's time (Monday 00:00
 * UTC+7), whatever the device's time zone, so their dates are shown there.
 */
export const LEADERBOARD_TIME_ZONE = 'Asia/Ho_Chi_Minh'

/**
 * The last moment of a period. The backend's `end` is exclusive (the start
 * of the next week), so the last day is the one holding `end` - 1 ms.
 */
export function lastMomentOfPeriod(end: Date): Date {
  return new Date(end.getTime() - 1)
}

/**
 * "Oct 12 - Oct 18, 2026", from the period the leaderboard reports, in
 * Vietnam's time. `formatDate` formats one date with the given options (eg
 * i18n.date); undefined for dates that do not parse.
 */
export function formatWeekRange(
  period: {start: string; end: string},
  formatDate: (d: Date, options: Intl.DateTimeFormatOptions) => string,
): string | undefined {
  const start = new Date(period.start)
  const end = new Date(period.end)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined
  }
  const long: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeZone: LEADERBOARD_TIME_ZONE,
  }
  const short: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    timeZone: LEADERBOARD_TIME_ZONE,
  }
  const last = lastMomentOfPeriod(end)
  if (last.getTime() <= start.getTime()) return formatDate(start, long)
  return `${formatDate(start, short)} - ${formatDate(last, long)}`
}

/** "#4", or a dash for someone not on the board */
export function formatRank(rank: number | undefined): string {
  return rank !== undefined && Number.isInteger(rank) && rank > 0
    ? `#${rank}`
    : '-'
}
