import {beforeEach, describe, expect, it, jest} from '@jest/globals'

const mockStore = new Map<string, unknown>()

jest.mock('#/storage', () => ({
  device: {
    get: (key: string[]) => mockStore.get(key.join('.')),
    set: (key: string[], value: unknown) => mockStore.set(key.join('.'), value),
  },
}))

import {
  type PendingTipRecord,
  pendingTipsFor,
  removePendingTip,
  savePendingTip,
} from '../pendingTips'

function tip(txHash: string, extra: Partial<PendingTipRecord> = {}) {
  return {
    recipient: 'did:plc:recipient',
    asset: 'eip155:8453/slip44:60',
    amount: '1000',
    txHash,
    from: '0xfrom',
    to: '0xto',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  } satisfies PendingTipRecord
}

describe('pending tips', () => {
  beforeEach(() => {
    mockStore.clear()
  })

  it('is empty when nothing is stored', () => {
    expect(pendingTipsFor('did:plc:alice')).toEqual([])
  })

  it('saves tips per account', () => {
    savePendingTip('did:plc:alice', 'rk0x1', tip('0x1'))
    savePendingTip('did:plc:alice', 'rk0x2', tip('0x2'))
    savePendingTip('did:plc:bob', 'rk0x3', tip('0x3'))
    expect(pendingTipsFor('did:plc:alice').map(t => t.record.txHash)).toEqual([
      '0x1',
      '0x2',
    ])
    expect(pendingTipsFor('did:plc:bob').map(t => t.record.txHash)).toEqual([
      '0x3',
    ])
    expect(pendingTipsFor('did:plc:carol')).toEqual([])
  })

  it('dedupes by txHash, keeping the latest record', () => {
    savePendingTip('did:plc:alice', 'rk0x1', tip('0x1', {message: 'old'}))
    savePendingTip('did:plc:alice', 'rk0x1', tip('0x1', {message: 'new'}))
    const tips = pendingTipsFor('did:plc:alice')
    expect(tips).toHaveLength(1)
    expect(tips[0].record.message).toBe('new')
  })

  it('removes a tip by txHash', () => {
    savePendingTip('did:plc:alice', 'rk0x1', tip('0x1'))
    savePendingTip('did:plc:alice', 'rk0x2', tip('0x2'))
    removePendingTip('0x1')
    expect(pendingTipsFor('did:plc:alice').map(t => t.record.txHash)).toEqual([
      '0x2',
    ])
  })

  it('keeps the rkey chosen when the tip was saved', () => {
    savePendingTip('did:plc:alice', 'rk-chosen', tip('0x1'))
    expect(pendingTipsFor('did:plc:alice')[0].rkey).toBe('rk-chosen')
  })

  it('ignores removing an unknown txHash', () => {
    savePendingTip('did:plc:alice', 'rk0x1', tip('0x1'))
    removePendingTip('0xnope')
    expect(pendingTipsFor('did:plc:alice')).toHaveLength(1)
  })
})
