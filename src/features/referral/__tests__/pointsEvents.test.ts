import {matchPointsEvent} from '../pointsEvents'

describe('matchPointsEvent', () => {
  it('matches the rewards service rule ids', () => {
    expect(matchPointsEvent('referral.inviter')).toBe('referral.inviter')
    expect(matchPointsEvent('referral.invitee')).toBe('referral.invitee')
    expect(matchPointsEvent('growth.wallet-linked')).toBe(
      'growth.wallet-linked',
    )
    expect(matchPointsEvent('growth.first-post')).toBe('growth.first-post')
  })
  it('tells the referrer rules apart from the actor rules', () => {
    expect(matchPointsEvent('growth.wallet-linked.referrer')).toBe(
      'growth.wallet-linked.referrer',
    )
    expect(matchPointsEvent('growth.first-post.referrer')).toBe(
      'growth.first-post.referrer',
    )
  })
  it('matches event names too', () => {
    expect(matchPointsEvent('wallet.linked')).toBe('growth.wallet-linked')
    expect(matchPointsEvent('post.first')).toBe('growth.first-post')
  })
  it('matches rule variants by prefix, not by lookalike', () => {
    expect(matchPointsEvent('growth.first-post.v2')).toBe('growth.first-post')
    expect(matchPointsEvent('growth.first-post-ever')).toBeUndefined()
    expect(matchPointsEvent('post.first_ever')).toBeUndefined()
  })
  it('takes the first id that matches', () => {
    expect(matchPointsEvent(undefined, 'x', 'growth.first-post')).toBe(
      'growth.first-post',
    )
    expect(matchPointsEvent(null, 'growth.wallet-linked')).toBe(
      'growth.wallet-linked',
    )
    expect(matchPointsEvent()).toBeUndefined()
    expect(matchPointsEvent('')).toBeUndefined()
  })
  it('knows the community and activity rules', () => {
    expect(matchPointsEvent('growth.community-joined')).toBe(
      'growth.community-joined',
    )
    expect(matchPointsEvent('growth.active-30d.referrer')).toBe(
      'growth.active-30d.referrer',
    )
    expect(matchPointsEvent('community.joined')).toBe('growth.community-joined')
    expect(matchPointsEvent('active.30d')).toBe('growth.active-30d')
  })
})
