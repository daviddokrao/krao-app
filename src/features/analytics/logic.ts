/*
 * Self-hosted analytics of the rewards service (net.krao.analytics.*):
 * aggregate figures, never per person. The shapes are typed here, and the
 * pure maths of the screen (percentages, funnel rows, retention cells) lives
 * here so it can be unit tested.
 */

export type FunnelStepId =
  'registered' | 'phoneVerified' | 'kycApproved' | 'walletLinked' | 'firstTip'

export type FunnelStep = {id: FunnelStepId; count: number}

export type Funnel = {since: string; until: string; steps: FunnelStep[]}

export type RetentionCohort = {
  /** The Monday (Vietnam time) the accounts of the cohort were created in */
  week: string
  size: number
  d1?: number
  d7?: number
  d30?: number
}

export type Retention = {cohorts: RetentionCohort[]}

export type AnalyticsSummary = {
  accounts: number
  activeToday: number
  active7d: number
  active30d: number
  posts7d?: number
}

export const FUNNEL_ORDER: FunnelStepId[] = [
  'registered',
  'phoneVerified',
  'kycApproved',
  'walletLinked',
  'firstTip',
]

export const RETENTION_KEYS = ['d1', 'd7', 'd30'] as const
export type RetentionKey = (typeof RETENTION_KEYS)[number]

/**
 * `part` as a percentage of `whole`, with one decimal (12.3); 0 when there
 * is no whole to compare with. Not capped: a part can exceed the whole.
 */
export function percent(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0
  return Math.round((part / whole) * 1000) / 10
}

/** "12.3%", "40%": a trailing ".0" is dropped */
export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`
}

export type FunnelRow = {
  id: FunnelStepId
  count: number
  /** Share of the first step (everyone who registered) */
  ofStart: number
  /** Share of the step before; the first step has 100 when it has accounts */
  ofPrevious: number
  /** Bar width, 0 to 100, relative to the first step (never above 100) */
  bar: number
}

/**
 * The funnel in its fixed order, with the share of the first step and of the
 * previous one. Steps the service did not send count as 0; steps it sends
 * twice keep the last count; unknown ids are dropped.
 */
export function buildFunnelRows(steps: FunnelStep[]): FunnelRow[] {
  const counts = new Map<FunnelStepId, number>()
  for (const step of steps) {
    if (FUNNEL_ORDER.includes(step.id)) {
      counts.set(step.id, Math.max(0, Math.floor(Number(step.count) || 0)))
    }
  }
  const start = counts.get('registered') ?? 0
  let previous = start
  return FUNNEL_ORDER.map((id, i) => {
    const count = counts.get(id) ?? 0
    const row: FunnelRow = {
      id,
      count,
      ofStart: percent(count, start),
      ofPrevious: i === 0 ? percent(count, count) : percent(count, previous),
      bar: Math.min(100, percent(count, start)),
    }
    previous = count
    return row
  })
}

export type RetentionCell = {count: number; percent: number}

/**
 * One cell of the retention table: the accounts of the cohort seen on day N
 * and their share of the cohort. Undefined while the day has not been fully
 * observed (the service leaves the field out).
 */
export function retentionCell(
  cohort: RetentionCohort,
  key: RetentionKey,
): RetentionCell | undefined {
  const count = cohort[key]
  if (count === undefined || count === null) return undefined
  return {count, percent: percent(count, cohort.size)}
}

/** Newest week first, as the table reads */
export function sortCohorts(cohorts: RetentionCohort[]): RetentionCohort[] {
  return [...cohorts].sort((a, b) => b.week.localeCompare(a.week))
}

export type FunnelRange = '7d' | '30d' | '90d'

const DAY_MS = 24 * 60 * 60 * 1000
const RANGE_DAYS: Record<FunnelRange, number> = {'7d': 7, '30d': 30, '90d': 90}

/** The period to ask for: the last N days up to `now` */
export function funnelPeriod(
  range: FunnelRange,
  now: Date = new Date(),
): {since: string; until: string} {
  return {
    since: new Date(now.getTime() - RANGE_DAYS[range] * DAY_MS).toISOString(),
    until: now.toISOString(),
  }
}

/** A cohort week (YYYY-MM-DD, a Monday) as a Date at noon UTC, safe in any zone */
export function cohortDate(week: string): Date {
  const [y, m, d] = week.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12))
}
