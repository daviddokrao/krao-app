/** Events (rule ids) that points are given for, as the rewards service names them */
export const POINTS_EVENTS = [
  'referral.inviter',
  'referral.invitee',
  'wallet.linked',
  'post.first',
] as const

export type PointsEvent = (typeof POINTS_EVENTS)[number]

/**
 * Which known event a points entry is for. Matches the event or rule id
 * exactly or as a prefix ("wallet.linked.v2"), so rule variants keep their
 * label; undefined for ones the app does not know yet.
 */
export function matchPointsEvent(
  ...ids: (string | undefined)[]
): PointsEvent | undefined {
  for (const id of ids) {
    if (!id) continue
    const hit = POINTS_EVENTS.find(e => id === e || id.startsWith(`${e}.`))
    if (hit) return hit
  }
  return undefined
}
