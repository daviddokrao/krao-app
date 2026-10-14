import {device} from '#/storage'

/** A net.krao.feed.tip record whose transfer was sent but not recorded yet */
export type PendingTipRecord = {
  recipient: `did:${string}:${string}`
  subject?: {uri: string; cid: string}
  asset: string
  amount: string
  txHash: string
  from: string
  to: string
  message?: string
  createdAt: string
}

/** `rkey` is chosen once, so writing the record again cannot duplicate it */
type PendingTip = {did: string; rkey: string; record: PendingTipRecord}

function all(): PendingTip[] {
  return device.get(['kraoPendingTips']) ?? []
}

/**
 * Kept before the tip record is written: the money has already moved, so a
 * failed write must not lose the tip. Written again on the next try.
 */
export function savePendingTip(
  did: string,
  rkey: string,
  record: PendingTipRecord,
) {
  device.set(
    ['kraoPendingTips'],
    [
      ...all().filter(t => t.record.txHash !== record.txHash),
      {did, rkey, record},
    ],
  )
}

export function removePendingTip(txHash: string) {
  device.set(
    ['kraoPendingTips'],
    all().filter(t => t.record.txHash !== txHash),
  )
}

export function pendingTipsFor(
  did: string,
): {rkey: string; record: PendingTipRecord}[] {
  return all()
    .filter(t => t.did === did && !!t.rkey)
    .map(({rkey, record}) => ({rkey, record}))
}
