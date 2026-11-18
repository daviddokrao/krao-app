import {beforeEach, describe, expect, it, jest} from '@jest/globals'

const mockStore = new Map<string, unknown>()

jest.mock('#/storage', () => ({
  device: {
    get: (key: string[]) => mockStore.get(key.join('.')),
    set: (key: string[], value: unknown) => mockStore.set(key.join('.'), value),
  },
}))

import {type PaymentRecord} from '../logic'
import {
  pendingPaymentsFor,
  removePendingPayment,
  savePendingPayment,
} from '../pendingPayments'

function payment(txHash: string): PaymentRecord {
  return {
    $type: 'net.krao.membership.payment',
    plan: {uri: 'at://did:plc:c/net.krao.membership.plan/1', cid: 'bafy'},
    creator: 'did:plc:c',
    chain: 'eip155:8453',
    txHash,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('pending membership payments', () => {
  beforeEach(() => mockStore.clear())

  it('keeps a payment per account until it is removed', () => {
    savePendingPayment('did:plc:me', 'rk1', payment('0x1'))
    savePendingPayment('did:plc:other', 'rk2', payment('0x2'))
    expect(pendingPaymentsFor('did:plc:me').map(p => p.rkey)).toEqual(['rk1'])
    removePendingPayment('0x1')
    expect(pendingPaymentsFor('did:plc:me')).toEqual([])
    expect(pendingPaymentsFor('did:plc:other')).toHaveLength(1)
  })

  it('does not keep the same transfer twice', () => {
    savePendingPayment('did:plc:me', 'rk1', payment('0x1'))
    savePendingPayment('did:plc:me', 'rk1', payment('0x1'))
    expect(pendingPaymentsFor('did:plc:me')).toHaveLength(1)
  })
})
