/*
 * Pure rules of Krao polls (net.krao.poll.*): how a draft becomes a record,
 * when a poll has ended and how results are shown. No React, no network.
 */

export const POLL_COLLECTION = 'net.krao.poll.poll'
export const OPTIONS_MIN = 2
export const OPTIONS_MAX = 4
export const OPTION_MAX_GRAPHEMES = 80
export const QUESTION_MAX_GRAPHEMES = 300
export const HOUR_MS = 60 * 60 * 1000
/** The longest a poll can run (the indexer ignores later end times) */
export const MAX_DURATION_MS = 30 * 24 * HOUR_MS

export type PollMode = 'account' | 'verified' | 'token'
export type ResultsVisibility = 'always' | 'afterEnd'

/** Durations offered in the composer, in hours */
export const DURATION_HOURS = [1, 24, 72, 168, 720] as const

export type PollDraft = {
  question: string
  options: string[]
  durationHours: number
  mode: PollMode
  /** CAIP-19 asset id, for token polls */
  asset: string
  resultsVisibility: ResultsVisibility
}

export const emptyPollDraft = (): PollDraft => ({
  question: '',
  options: ['', ''],
  durationHours: 24,
  mode: 'account',
  asset: '',
  resultsVisibility: 'always',
})

export type PollProblem = 'options' | 'optionLength' | 'question' | 'asset'

const graphemes = (text: string) => [...text].length

/** The options that count: trimmed, without empty ones */
export function filledOptions(draft: PollDraft): string[] {
  return draft.options.map(o => o.trim()).filter(Boolean)
}

export function validatePollDraft(draft: PollDraft): PollProblem[] {
  const problems: PollProblem[] = []
  const options = filledOptions(draft)
  if (options.length < OPTIONS_MIN || options.length > OPTIONS_MAX) {
    problems.push('options')
  }
  if (options.some(o => graphemes(o) > OPTION_MAX_GRAPHEMES)) {
    problems.push('optionLength')
  }
  if (graphemes(draft.question.trim()) > QUESTION_MAX_GRAPHEMES) {
    problems.push('question')
  }
  if (draft.mode === 'token' && !draft.asset) problems.push('asset')
  return problems
}

/** When the poll ends, never later than the 30 day cap */
export function pollEndsAt(draft: PollDraft, now: Date): Date {
  const ms = Math.min(
    Math.max(draft.durationHours, 1) * HOUR_MS,
    MAX_DURATION_MS,
  )
  return new Date(now.getTime() + ms)
}

/**
 * The poll record written with the post. Its record key is the post's, so
 * the indexer finds the poll of a post without a lookup.
 */
export function buildPollRecord({
  draft,
  post,
  now,
  toDatetime,
}: {
  draft: PollDraft
  post: {uri: string; cid: string}
  now: Date
  toDatetime: (date: Date) => string
}) {
  const question = draft.question.trim()
  return {
    $type: POLL_COLLECTION,
    post,
    ...(question ? {question} : {}),
    options: filledOptions(draft),
    endsAt: toDatetime(pollEndsAt(draft, now)),
    mode: draft.mode,
    ...(draft.mode === 'token' ? {asset: draft.asset} : {}),
    resultsVisibility: draft.resultsVisibility,
    createdAt: toDatetime(now),
  }
}

export function isPollEnded(endsAt: string, now: Date): boolean {
  return new Date(endsAt).getTime() <= now.getTime()
}

/** Time left, as the largest unit that is not zero */
export function timeLeft(
  endsAt: string,
  now: Date,
): {unit: 'days' | 'hours' | 'minutes'; value: number} | undefined {
  const ms = new Date(endsAt).getTime() - now.getTime()
  if (ms <= 0) return
  const days = Math.floor(ms / (24 * HOUR_MS))
  if (days >= 1) return {unit: 'days', value: days}
  const hours = Math.floor(ms / HOUR_MS)
  if (hours >= 1) return {unit: 'hours', value: hours}
  return {unit: 'minutes', value: Math.max(1, Math.ceil(ms / 60000))}
}

export type OptionShare = {index: number; text: string; percent: number}

/**
 * Each option's share of the result, in whole percent, by weight in token
 * polls and by vote in the others. The shares are rounded down and the rest
 * goes to the largest, so they sum to 100 once anyone has voted.
 */
export function optionShares(
  options: {index: number; text: string; votes?: number; weight?: string}[],
  mode: PollMode,
): OptionShare[] {
  const amounts = options.map(o => {
    if (mode === 'token') {
      try {
        return BigInt(o.weight ?? '0')
      } catch {
        return 0n
      }
    }
    return BigInt(o.votes ?? 0)
  })
  const total = amounts.reduce((sum, v) => sum + v, 0n)
  if (total === 0n) {
    return options.map(o => ({index: o.index, text: o.text, percent: 0}))
  }
  const percents = amounts.map(v => Number((v * 100n) / total))
  let rest = 100 - percents.reduce((sum, p) => sum + p, 0)
  const order = amounts
    .map((v, i) => ({v, i}))
    .sort((x, y) => (y.v > x.v ? 1 : y.v < x.v ? -1 : x.i - y.i))
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) {
    percents[order[k].i]++
  }
  return options.map((o, i) => ({
    index: o.index,
    text: o.text,
    percent: percents[i],
  }))
}

/** The indexes with the most votes or weight (several on a tie), if any */
export function leadingOptions(
  options: {index: number; votes?: number; weight?: string}[],
  mode: PollMode,
): number[] {
  const amount = (o: (typeof options)[number]) => {
    if (mode === 'token') {
      try {
        return BigInt(o.weight ?? '0')
      } catch {
        return 0n
      }
    }
    return BigInt(o.votes ?? 0)
  }
  let best = 0n
  for (const o of options) if (amount(o) > best) best = amount(o)
  if (best === 0n) return []
  return options.filter(o => amount(o) === best).map(o => o.index)
}

export type VoteBlock =
  'ended' | 'alreadyVoted' | 'signedOut' | 'needsWallet' | undefined

/**
 * Why the viewer cannot vote (or should link a wallet first). In a token
 * poll an account without a linked wallet would vote with weight 0 and use up
 * its only vote.
 */
export function getVoteBlock({
  ended,
  hasVoted,
  signedIn,
  mode,
  hasWallet,
}: {
  ended: boolean
  hasVoted: boolean
  signedIn: boolean
  mode: PollMode
  /** undefined while the wallets are still loading */
  hasWallet: boolean | undefined
}): VoteBlock {
  if (ended) return 'ended'
  if (hasVoted) return 'alreadyVoted'
  if (!signedIn) return 'signedOut'
  if (mode === 'token' && hasWallet === false) return 'needsWallet'
  return undefined
}
