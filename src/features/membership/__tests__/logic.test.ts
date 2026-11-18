import {describe, expect, it} from '@jest/globals'

import {
  buildBars,
  buildPaymentRecord,
  buildPlanRecord,
  canAddPlan,
  describeExpiry,
  EMPTY_PLAN_DRAFT,
  formatChange,
  formatUsd,
  formatUsdc,
  isMembershipActive,
  isPlanDraftValid,
  parsePriceUsdc,
  priceToInput,
  splitPerks,
  validatePlanDraft,
} from '../logic'

describe('parsePriceUsdc', () => {
  it('turns dollars into USDC base units', () => {
    expect(parsePriceUsdc('5')).toBe('5000000')
    expect(parsePriceUsdc('9.99')).toBe('9990000')
    expect(parsePriceUsdc(' 1000 ')).toBe('1000000000')
  })

  it('keeps prices between $1 and $1000', () => {
    expect(parsePriceUsdc('0.99')).toBeNull()
    expect(parsePriceUsdc('0')).toBeNull()
    expect(parsePriceUsdc('1000.01')).toBeNull()
  })

  it('rejects things that are not amounts', () => {
    expect(parsePriceUsdc('')).toBeNull()
    expect(parsePriceUsdc('abc')).toBeNull()
    expect(parsePriceUsdc('-5')).toBeNull()
    expect(parsePriceUsdc('5.1234567')).toBeNull()
  })
})

describe('formatUsdc', () => {
  it('shows whole dollars without decimals', () => {
    expect(formatUsdc('5000000')).toBe('5')
  })

  it('shows cents as two digits', () => {
    expect(formatUsdc('5500000')).toBe('5.50')
    expect(formatUsdc('9990000')).toBe('9.99')
  })

  it('does not throw on junk', () => {
    expect(formatUsdc('x')).toBe('x')
  })

  it('round trips through the input form', () => {
    expect(priceToInput('9990000')).toBe('9.99')
    expect(parsePriceUsdc(priceToInput('12500000'))).toBe('12500000')
  })
})

describe('plan validation', () => {
  const ok = {name: 'Supporter', description: '', price: '5', perks: ''}

  it('accepts a minimal plan', () => {
    expect(isPlanDraftValid(ok)).toBe(true)
    expect(isPlanDraftValid(EMPTY_PLAN_DRAFT)).toBe(false)
  })

  it('needs a name of at most 64 characters', () => {
    expect(validatePlanDraft({...ok, name: '  '}).name).toBe(true)
    expect(validatePlanDraft({...ok, name: 'a'.repeat(65)}).name).toBe(true)
    expect(
      validatePlanDraft({...ok, name: 'a'.repeat(64)}).name,
    ).toBeUndefined()
  })

  it('counts an emoji as one character', () => {
    expect(
      validatePlanDraft({...ok, name: '\u{1F600}'.repeat(64)}).name,
    ).toBeUndefined()
  })

  it('limits the description to 500 characters', () => {
    expect(
      validatePlanDraft({...ok, description: 'a'.repeat(501)}).description,
    ).toBe(true)
  })

  it('limits perks to 5 of at most 100 characters', () => {
    expect(splitPerks('a\n\n b \n')).toEqual(['a', 'b'])
    expect(validatePlanDraft({...ok, perks: 'a\nb\nc\nd\ne'}).perks).toBe(
      undefined,
    )
    expect(validatePlanDraft({...ok, perks: 'a\nb\nc\nd\ne\nf'}).perks).toBe(
      true,
    )
    expect(validatePlanDraft({...ok, perks: 'a'.repeat(101)}).perks).toBe(true)
  })

  it('flags a price out of range', () => {
    expect(validatePlanDraft({...ok, price: '0.5'}).price).toBe(true)
  })
})

describe('records', () => {
  it('builds a plan record without empty optional fields', () => {
    expect(
      buildPlanRecord(
        {name: ' Fan ', description: ' ', price: '5', perks: ''},
        {active: true, createdAt: '2026-01-01T00:00:00.000Z'},
      ),
    ).toEqual({
      $type: 'net.krao.membership.plan',
      name: 'Fan',
      description: undefined,
      priceUsdc: '5000000',
      perks: undefined,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('keeps perks and the description', () => {
    const record = buildPlanRecord(
      {name: 'Fan', description: 'Hi', price: '2.5', perks: 'x\ny'},
      {active: false, createdAt: 'now'},
    )
    expect(record.perks).toEqual(['x', 'y'])
    expect(record.description).toBe('Hi')
    expect(record.priceUsdc).toBe('2500000')
    expect(record.active).toBe(false)
  })

  it('builds a payment record on Base', () => {
    expect(
      buildPaymentRecord({
        plan: {uri: 'at://did:plc:a/net.krao.membership.plan/1', cid: 'bafy'},
        creator: 'did:plc:a',
        txHash: '0xabc',
        createdAt: 'now',
      }),
    ).toEqual({
      $type: 'net.krao.membership.payment',
      plan: {uri: 'at://did:plc:a/net.krao.membership.plan/1', cid: 'bafy'},
      creator: 'did:plc:a',
      chain: 'eip155:8453',
      txHash: '0xabc',
      createdAt: 'now',
    })
  })

  it('allows three active plans at most', () => {
    const plan = (active: boolean) => ({active})
    expect(canAddPlan([plan(true), plan(true)])).toBe(true)
    expect(canAddPlan([plan(true), plan(true), plan(true)])).toBe(false)
    // Deactivated plans do not count
    expect(canAddPlan([plan(true), plan(true), plan(false), plan(false)])).toBe(
      true,
    )
  })
})

describe('describeExpiry', () => {
  const now = new Date('2026-06-01T12:00:00.000Z')

  it('has nothing to say without an expiry', () => {
    expect(describeExpiry(undefined, now)).toBeNull()
    expect(describeExpiry('nope', now)).toBeNull()
  })

  it('rounds the days left up', () => {
    expect(describeExpiry('2026-06-02T11:00:00.000Z', now)).toEqual({
      daysLeft: 1,
      expired: false,
      renewSoon: true,
    })
    expect(describeExpiry('2026-06-30T12:00:00.000Z', now)).toEqual({
      daysLeft: 29,
      expired: false,
      renewSoon: false,
    })
  })

  it('suggests renewing in the last week', () => {
    expect(describeExpiry('2026-06-08T12:00:00.000Z', now)?.renewSoon).toBe(
      true,
    )
    expect(describeExpiry('2026-06-09T12:00:00.000Z', now)?.renewSoon).toBe(
      false,
    )
  })

  it('is expired at and after the end', () => {
    expect(describeExpiry('2026-06-01T12:00:00.000Z', now)?.expired).toBe(true)
    expect(describeExpiry('2026-05-01T00:00:00.000Z', now)).toEqual({
      daysLeft: 0,
      expired: true,
      renewSoon: true,
    })
  })
})

describe('isMembershipActive', () => {
  const now = new Date('2026-06-01T12:00:00.000Z')

  it('needs an active status that has not run out', () => {
    expect(isMembershipActive(undefined, now)).toBe(false)
    expect(
      isMembershipActive(
        {status: 'active', expiresAt: '2026-06-10T00:00:00.000Z'},
        now,
      ),
    ).toBe(true)
    expect(
      isMembershipActive(
        {status: 'active', expiresAt: '2026-05-10T00:00:00.000Z'},
        now,
      ),
    ).toBe(false)
    expect(isMembershipActive({status: 'pending'}, now)).toBe(false)
    expect(isMembershipActive({status: 'active'}, now)).toBe(true)
  })
})

describe('dashboard figures', () => {
  it('formats dollars', () => {
    expect(formatUsd(12)).toBe('$12')
    expect(formatUsd('12.5')).toBe('$12.5')
    expect(formatUsd(1234.56)).toBe('$1,235')
    expect(formatUsd(undefined)).toBe('$0')
  })

  it('formats a change', () => {
    expect(formatChange(12)).toBe('+12')
    expect(formatChange(-3)).toBe('-3')
    expect(formatChange(0)).toBe('0')
    expect(formatChange(undefined)).toBeNull()
  })

  it('scales bars to the tallest value', () => {
    const bars = buildBars([0, 5, 10], 100, 50, 0)
    expect(bars).toHaveLength(3)
    expect(bars[0].height).toBe(0)
    expect(bars[1].height).toBeCloseTo(25)
    expect(bars[2]).toMatchObject({y: 0, height: 50})
  })

  it('keeps tiny values visible and handles no data', () => {
    expect(buildBars([0.01, 1000], 100, 100, 0)[0].height).toBe(2)
    expect(buildBars([], 100, 100)).toEqual([])
    expect(buildBars([0, 0], 100, 100).every(b => b.height === 0)).toBe(true)
    expect(buildBars([1], 0, 100)).toEqual([])
  })
})
