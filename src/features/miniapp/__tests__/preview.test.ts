import {describe, expect, it} from '@jest/globals'

import {
  type BalanceChange,
  decodeErc20Transfer,
  describeApproval,
  describeChange,
  evaluatePreview,
  sortWarnings,
  transactionParties,
} from '../preview'

const warn = (code: string, severity: 'info' | 'warning' | 'danger') => ({
  code,
  severity,
})

describe('evaluatePreview', () => {
  it('fails open with a notice when there is no answer', () => {
    expect(evaluatePreview(undefined)).toEqual({
      unavailable: true,
      danger: false,
      canSign: true,
      needsAck: false,
      decodeOnly: false,
    })
  })

  it('lets a clean simulation through', () => {
    expect(evaluatePreview({ok: true, warnings: [], method: 'trace'})).toEqual({
      unavailable: false,
      danger: false,
      canSign: true,
      needsAck: false,
      decodeOnly: false,
    })
  })

  it('blocks a transaction that would revert', () => {
    const v = evaluatePreview({
      ok: false,
      warnings: [warn('reverts', 'danger')],
    })
    expect(v.canSign).toBe(false)
    expect(v.needsAck).toBe(false)
  })

  it('blocks ok:false with no warnings at all', () => {
    expect(evaluatePreview({ok: false, warnings: []}).canSign).toBe(false)
  })

  it('allows ok:false when only the simulation was unavailable', () => {
    const v = evaluatePreview({
      ok: false,
      warnings: [warn('simulationUnavailable', 'warning')],
      method: 'decode',
    })
    expect(v.canSign).toBe(true)
    expect(v.unavailable).toBe(true)
    expect(v.decodeOnly).toBe(true)
  })

  it('keeps the other warnings when only decoding (the RPC is down)', () => {
    const v = evaluatePreview({
      ok: false,
      method: 'decode',
      warnings: [
        warn('simulationUnavailable', 'warning'),
        warn('unknownContract', 'info'),
        warn('unlimitedApproval', 'danger'),
      ],
    })
    expect(v).toMatchObject({canSign: true, danger: true, needsAck: true})
  })

  it('does not allow ok:false with a revert reason', () => {
    const v = evaluatePreview({
      ok: false,
      revertReason: 'ERC20: insufficient balance',
      warnings: [warn('simulationUnavailable', 'warning')],
    })
    expect(v.canSign).toBe(false)
  })

  it('does not allow ok:false when unavailable comes with a revert', () => {
    const v = evaluatePreview({
      ok: false,
      warnings: [
        warn('simulationUnavailable', 'warning'),
        warn('reverts', 'danger'),
      ],
    })
    expect(v.canSign).toBe(false)
  })

  it('needs the tick for any danger warning', () => {
    const v = evaluatePreview({
      ok: true,
      warnings: [
        warn('unlimitedApproval', 'danger'),
        warn('unknownContract', 'info'),
      ],
    })
    expect(v).toMatchObject({danger: true, canSign: true, needsAck: true})
  })

  it('does not need the tick for warnings below danger', () => {
    const v = evaluatePreview({
      ok: true,
      warnings: [
        warn('unknownContract', 'info'),
        warn('chainMismatch', 'warning'),
      ],
    })
    expect(v).toMatchObject({danger: false, needsAck: false, canSign: true})
  })

  it('marks decode-only results', () => {
    expect(
      evaluatePreview({ok: true, warnings: [], method: 'decode'}).decodeOnly,
    ).toBe(true)
  })
})

describe('sortWarnings', () => {
  it('puts danger first and keeps the service order within a level', () => {
    const sorted = sortWarnings([
      warn('a', 'info'),
      warn('b', 'danger'),
      warn('c', 'warning'),
      warn('d', 'danger'),
    ])
    expect(sorted.map(w => w.code)).toEqual(['b', 'd', 'c', 'a'])
  })
})

describe('describeChange', () => {
  const change = (c: Partial<BalanceChange>): BalanceChange => ({
    direction: 'out',
    kind: 'native',
    ...c,
  })

  it('formats native ETH', () => {
    expect(describeChange(change({amount: '100000000000000'}))).toMatchObject({
      direction: 'out',
      amount: '0.0001',
      asset: 'ETH',
    })
  })

  it('formats an ERC-20 with its decimals', () => {
    expect(
      describeChange(
        change({
          kind: 'erc20',
          amount: '5000000',
          token: {address: '0xusdc', symbol: 'USDC', decimals: 6},
        }),
      ),
    ).toMatchObject({amount: '5', asset: 'USDC'})
  })

  it('shows raw units when the decimals are unknown', () => {
    expect(
      describeChange(
        change({
          kind: 'erc20',
          amount: '123',
          token: {address: '0xabcdef0123456789'},
        }),
      ),
    ).toEqual({
      direction: 'out',
      counterparty: undefined,
      amount: undefined,
      raw: '123',
      asset: '0xabcd...6789',
    })
  })

  it('names an NFT by its id, and an ERC-1155 by its count', () => {
    expect(
      describeChange(
        change({
          direction: 'in',
          kind: 'erc721',
          tokenId: '12',
          token: {address: '0x1', name: 'Punks'},
        }),
      ),
    ).toMatchObject({direction: 'in', amount: '#12', asset: 'Punks'})
    expect(
      describeChange(
        change({
          kind: 'erc1155',
          tokenId: '7',
          amount: '3',
          token: {address: '0x1', symbol: 'ITEM'},
        }),
      ).amount,
    ).toBe('3 x #7')
  })

  it('does not trust a non-numeric amount', () => {
    expect(describeChange(change({amount: 'a lot'})).amount).toBeUndefined()
  })
})

describe('describeApproval', () => {
  const token = {address: '0xusdc', symbol: 'USDC', decimals: 6}

  it('says unlimited', () => {
    expect(
      describeApproval({kind: 'erc20', token, spender: '0xs', unlimited: true}),
    ).toMatchObject({asset: 'USDC', unlimited: true, amount: undefined})
  })

  it('formats a limited amount', () => {
    expect(
      describeApproval({
        kind: 'erc20',
        token,
        spender: '0xs',
        amount: '2500000',
        unlimited: false,
      }),
    ).toMatchObject({amount: '2.5', unlimited: false})
  })

  it('falls back to a short address for an unnamed token', () => {
    expect(
      describeApproval({
        kind: 'approvalForAll',
        token: {address: '0x1234567890abcdef'},
        spender: '0xs',
        unlimited: true,
      }).asset,
    ).toBe('0x1234...cdef')
  })
})

describe('token transfers', () => {
  const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
  const CREATOR = '0x1111111111111111111111111111111111111111'
  const data =
    '0xa9059cbb' +
    CREATOR.slice(2).padStart(64, '0') +
    (5_000_000).toString(16).padStart(64, '0')

  it('reads the real recipient and amount of an ERC-20 transfer', () => {
    expect(decodeErc20Transfer(data)).toEqual({
      recipient: CREATOR,
      amount: '5000000',
    })
    expect(transactionParties({to: USDC, data})).toEqual({
      recipient: CREATOR,
      tokenContract: USDC,
      tokenAmount: '5000000',
    })
  })

  it('keeps `to` as the recipient of anything else', () => {
    expect(transactionParties({to: CREATOR})).toEqual({recipient: CREATOR})
    // approve(address,uint256) has the same shape and another selector
    const approve = '0x095ea7b3' + data.slice(10)
    expect(transactionParties({to: USDC, data: approve})).toEqual({
      recipient: USDC,
    })
  })

  it('refuses calldata that is not a clean transfer', () => {
    expect(decodeErc20Transfer(undefined)).toBeUndefined()
    expect(decodeErc20Transfer(data + '00')).toBeUndefined()
    expect(decodeErc20Transfer(data.slice(0, -2))).toBeUndefined()
    // Dirty high bytes in the address word
    const dirty = '0xa9059cbb' + 'ff' + data.slice(12)
    expect(decodeErc20Transfer(dirty)).toBeUndefined()
    expect(decodeErc20Transfer('0xa9059cbb' + 'zz'.repeat(64))).toBeUndefined()
  })
})
