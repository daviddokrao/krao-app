import {device} from '#/storage'
import {type PaymentRecord} from './logic'

/** A membership payment whose transfer was sent but not recorded yet */
type PendingPayment = {did: string; rkey: string; record: PaymentRecord}

function all(): PendingPayment[] {
  return device.get(['kraoPendingPayments']) ?? []
}

/**
 * Kept before the payment record is written: the money has already moved, so
 * a failed write must not lose the payment. `rkey` is chosen once, so writing
 * the record again cannot duplicate it.
 */
export function savePendingPayment(
  did: string,
  rkey: string,
  record: PaymentRecord,
) {
  device.set(
    ['kraoPendingPayments'],
    [
      ...all().filter(p => p.record.txHash !== record.txHash),
      {did, rkey, record},
    ],
  )
}

export function removePendingPayment(txHash: string) {
  device.set(
    ['kraoPendingPayments'],
    all().filter(p => p.record.txHash !== txHash),
  )
}

export function pendingPaymentsFor(
  did: string,
): {rkey: string; record: PaymentRecord}[] {
  return all()
    .filter(p => p.did === did && !!p.rkey)
    .map(({rkey, record}) => ({rkey, record}))
}
