import {formatUnits, parseUnits} from '#/features/tips/assets'

/*
 * Pure rules of creator memberships (net.krao.membership.*): prices in USDC,
 * plan validation, the shape of the records the app writes and how an expiry
 * is shown. No React and no network, so they can be unit tested.
 */

export const PLAN_COLLECTION = 'net.krao.membership.plan'
export const PAYMENT_COLLECTION = 'net.krao.membership.payment'

/** Payments are made on Base, like tips */
export const MEMBERSHIP_CHAIN = 'eip155:8453'

export const USDC_DECIMALS = 6
/** One membership period; there is no auto-renew yet */
export const PERIOD_DAYS = 30
export const PLANS_MAX = 3
export const PLAN_NAME_MAX = 64
export const PLAN_DESCRIPTION_MAX = 500
export const PLAN_PERKS_MAX = 5
export const PERK_MAX = 100
export const PRICE_MIN_USD = 1
export const PRICE_MAX_USD = 1000

const DAY_MS = 24 * 60 * 60 * 1000

/** Characters as people count them (an emoji is one, not two) */
function length(text: string): number {
  return Array.from(text).length
}

/**
 * A price typed in dollars ("5", "9.99") as USDC base units ("5000000"), or
 * null when it is not a number or outside $1 to $1000.
 */
export function parsePriceUsdc(text: string): string | null {
  const units = parseUnits(text, USDC_DECIMALS)
  if (units === null) return null
  const min = BigInt(PRICE_MIN_USD) * 10n ** BigInt(USDC_DECIMALS)
  const max = BigInt(PRICE_MAX_USD) * 10n ** BigInt(USDC_DECIMALS)
  if (units < min || units > max) return null
  return units.toString()
}

/** USDC base units for display: "5000000" -> "5", "9990000" -> "9.99" */
export function formatUsdc(baseUnits: string): string {
  try {
    const text = formatUnits(baseUnits, USDC_DECIMALS)
    // Prices read as money: 5.5 is "5.50"
    const [whole, fraction] = text.split('.')
    return fraction !== undefined && fraction.length < 2
      ? `${whole}.${fraction.padEnd(2, '0')}`
      : text
  } catch {
    return baseUnits
  }
}

/** The base units of a price shown as text, for editing: "9.99" */
export function priceToInput(baseUnits: string): string {
  try {
    return formatUnits(baseUnits, USDC_DECIMALS)
  } catch {
    return ''
  }
}

export type PlanDraft = {
  name: string
  description: string
  /** In dollars, as typed */
  price: string
  /** One perk per line */
  perks: string
}

export type PlanDraftErrors = Partial<
  Record<'name' | 'description' | 'price' | 'perks', true>
>

export const EMPTY_PLAN_DRAFT: PlanDraft = {
  name: '',
  description: '',
  price: '5',
  perks: '',
}

/** The perks field: one per line, blank lines dropped */
export function splitPerks(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

/** Which fields of a plan form are not valid yet */
export function validatePlanDraft(draft: PlanDraft): PlanDraftErrors {
  const errors: PlanDraftErrors = {}
  const name = draft.name.trim()
  if (!name || length(name) > PLAN_NAME_MAX) errors.name = true
  if (length(draft.description.trim()) > PLAN_DESCRIPTION_MAX) {
    errors.description = true
  }
  if (parsePriceUsdc(draft.price) === null) errors.price = true
  const perks = splitPerks(draft.perks)
  if (perks.length > PLAN_PERKS_MAX || perks.some(p => length(p) > PERK_MAX)) {
    errors.perks = true
  }
  return errors
}

export function isPlanDraftValid(draft: PlanDraft): boolean {
  return Object.keys(validatePlanDraft(draft)).length === 0
}

export type PlanRecord = {
  $type: typeof PLAN_COLLECTION
  name: string
  description?: string
  priceUsdc: string
  perks?: string[]
  active: boolean
  createdAt: string
}

/** The net.krao.membership.plan record for a valid form */
export function buildPlanRecord(
  draft: PlanDraft,
  {active, createdAt}: {active: boolean; createdAt: string},
): PlanRecord {
  const description = draft.description.trim()
  const perks = splitPerks(draft.perks)
  return {
    $type: PLAN_COLLECTION,
    name: draft.name.trim(),
    description: description || undefined,
    priceUsdc: parsePriceUsdc(draft.price) ?? '0',
    perks: perks.length ? perks : undefined,
    active,
    createdAt,
  }
}

export type PaymentRecord = {
  $type: typeof PAYMENT_COLLECTION
  plan: {uri: string; cid: string}
  creator: string
  chain: typeof MEMBERSHIP_CHAIN
  txHash: string
  createdAt: string
}

export function buildPaymentRecord({
  plan,
  creator,
  txHash,
  createdAt,
}: {
  plan: {uri: string; cid: string}
  creator: string
  txHash: string
  createdAt: string
}): PaymentRecord {
  return {
    $type: PAYMENT_COLLECTION,
    plan: {uri: plan.uri, cid: plan.cid},
    creator,
    chain: MEMBERSHIP_CHAIN,
    txHash,
    createdAt,
  }
}

/** Plans a creator can still add: at most three are active at once */
export function canAddPlan(plans: {active: boolean}[]): boolean {
  return plans.filter(p => p.active).length < PLANS_MAX
}

export type MembershipStatus = 'active' | 'expired' | 'pending' | 'invalid'

export type ExpiryInfo = {
  /** Whole days left, rounded up; 0 once expired */
  daysLeft: number
  expired: boolean
  /** Within a week of ending (or ended): a good time to renew */
  renewSoon: boolean
}

/** How far along a membership is, relative to `now` */
export function describeExpiry(
  expiresAt: string | undefined,
  now: Date,
): ExpiryInfo | null {
  if (!expiresAt) return null
  const end = Date.parse(expiresAt)
  if (!Number.isFinite(end)) return null
  const left = end - now.getTime()
  if (left <= 0) return {daysLeft: 0, expired: true, renewSoon: true}
  const daysLeft = Math.ceil(left / DAY_MS)
  return {daysLeft, expired: false, renewSoon: daysLeft <= 7}
}

/** Whether the membership grants access right now */
export function isMembershipActive(
  membership: {status: MembershipStatus; expiresAt?: string} | undefined,
  now: Date,
): boolean {
  if (!membership || membership.status !== 'active') return false
  const info = describeExpiry(membership.expiresAt, now)
  // No expiry given: trust the indexer's status
  return info ? !info.expired : true
}

/** Whole dollars and cents for a USD figure from the indexer */
export function formatUsd(value: number | string | undefined): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '$0'
  return n >= 100
    ? `$${Math.round(n).toLocaleString('en-US')}`
    : `$${n.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2})}`
}

export type DailyPoint = {date: string; tipsUsd: number; newMembers: number}

export type Bar = {x: number; y: number; width: number; height: number}

/**
 * Bars for a column chart in a `width` x `height` box. The tallest value
 * fills the height; a zero value gets no bar. Values are tips in USD.
 */
export function buildBars(
  values: number[],
  width: number,
  height: number,
  gap = 2,
): Bar[] {
  if (!values.length || width <= 0 || height <= 0) return []
  const max = Math.max(...values.map(v => (Number.isFinite(v) ? v : 0)), 0)
  const barWidth = Math.max(
    1,
    (width - gap * (values.length - 1)) / values.length,
  )
  return values.map((value, i) => {
    const v = Number.isFinite(value) && value > 0 ? value : 0
    const h = max > 0 ? Math.max(v > 0 ? 2 : 0, (v / max) * height) : 0
    return {x: i * (barWidth + gap), y: height - h, width: barWidth, height: h}
  })
}

/** The change in followers as text ("+12", "-3", "0"), or null if unknown */
export function formatChange(change: number | undefined): string | null {
  if (change === undefined || !Number.isFinite(change)) return null
  return change > 0 ? `+${change}` : String(change)
}
