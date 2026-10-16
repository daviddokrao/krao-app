import {matchPointsEvent} from '../pointsEvents'

describe('matchPointsEvent', () => {
  it('matches the known events', () => {
    expect(matchPointsEvent('wallet.linked')).toBe('wallet.linked')
    expect(matchPointsEvent('post.first')).toBe('post.first')
    expect(matchPointsEvent('referral.inviter')).toBe('referral.inviter')
    expect(matchPointsEvent('referral.invitee')).toBe('referral.invitee')
  })
  it('matches rule variants by prefix, not by lookalike', () => {
    expect(matchPointsEvent('wallet.linked.v2')).toBe('wallet.linked')
    expect(matchPointsEvent('post.first_ever')).toBeUndefined()
  })
  it('takes the first id that matches', () => {
    expect(matchPointsEvent(undefined, 'x', 'post.first')).toBe('post.first')
    expect(matchPointsEvent()).toBeUndefined()
    expect(matchPointsEvent('')).toBeUndefined()
  })
})
