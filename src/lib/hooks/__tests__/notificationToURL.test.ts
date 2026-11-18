import {describe, expect, it} from '@jest/globals'

import {type NotificationPayload} from '#/lib/hooks/useNotificationHandler'
import {notificationToURL} from '#/lib/notifications/notificationToURL'

const payload = (p: Record<string, string>) =>
  ({
    recipientDid: 'did:plc:me',
    uri: '',
    subject: '',
    ...p,
  }) as NotificationPayload

describe('notificationToURL for Krao pushes', () => {
  it('opens the tipped post', () => {
    expect(
      notificationToURL(
        payload({
          reason: 'krao-tip',
          subject: 'at://did:plc:me/app.bsky.feed.post/3abc',
          uri: 'at://did:plc:me/app.bsky.feed.post/3abc',
        }),
      ),
    ).toBe('/profile/did:plc:me/post/3abc')
  })

  it('opens the tipper for a profile tip', () => {
    expect(
      notificationToURL(
        payload({reason: 'krao-tip', uri: 'at://did:plc:tipper'}),
      ),
    ).toBe('/profile/did:plc:tipper')
  })

  it('opens Invite friends for points and KYC', () => {
    expect(notificationToURL(payload({reason: 'krao-points'}))).toBe(
      '/settings/referral',
    )
    expect(notificationToURL(payload({reason: 'krao-kyc'}))).toBe(
      '/settings/referral',
    )
  })
})
