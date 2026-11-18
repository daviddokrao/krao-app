/**
 * What points are given for. The rewards service's ledger entries carry the
 * rule id (eg `growth.first-post`), not the event, so both forms are known:
 * rule ids, and event names (`post.first`) in case an entry ever carries one.
 */
export const POINTS_EVENTS = [
  'referral.inviter',
  'referral.invitee',
  'growth.wallet-linked',
  'growth.wallet-linked.referrer',
  'growth.first-post',
  'growth.first-post.referrer',
  'growth.community-joined',
  'growth.community-joined.referrer',
  'growth.active-30d',
  'growth.active-30d.referrer',
] as const

export type PointsEvent = (typeof POINTS_EVENTS)[number]

/** Event names of the rewards service, for the rules they trigger */
const EVENT_ALIASES: Record<string, PointsEvent> = {
  'wallet.linked': 'growth.wallet-linked',
  'post.first': 'growth.first-post',
  'community.joined': 'growth.community-joined',
  'active.30d': 'growth.active-30d',
}

/**
 * Which known rule a points entry is for. Matches a rule id or event name
 * exactly, or as the longest prefix ("growth.first-post.v2" is a variant of
 * "growth.first-post"; "growth.first-post.referrer" is its own rule);
 * undefined for ones the app does not know yet.
 */
export function matchPointsEvent(
  ...ids: (string | null | undefined)[]
): PointsEvent | undefined {
  for (const id of ids) {
    if (!id) continue
    const known: [string, PointsEvent][] = [
      ...POINTS_EVENTS.map(e => [e, e] as [string, PointsEvent]),
      ...Object.entries(EVENT_ALIASES),
    ]
    let best: [string, PointsEvent] | undefined
    for (const [key, event] of known) {
      if (
        (id === key || id.startsWith(`${key}.`)) &&
        (!best || key.length > best[0].length)
      ) {
        best = [key, event]
      }
    }
    if (best) return best[1]
  }
  return undefined
}
