import {AtUri} from '@atproto/syntax'

import {type NotificationPayload} from '#/lib/hooks/useNotificationHandler'

/** Where tapping a push leads, or null to stay put */
export function notificationToURL(payload: NotificationPayload): string | null {
  switch (payload?.reason) {
    case 'like':
    case 'repost':
    case 'like-via-repost':
    case 'repost-via-repost': {
      const urip = new AtUri(payload.subject)
      if (urip.collection === 'app.bsky.feed.post') {
        return `/profile/${urip.host}/post/${urip.rkey}`
      } else {
        return '/notifications'
      }
    }
    case 'reply':
    case 'quote':
    case 'mention':
    case 'subscribed-post': {
      const urip = new AtUri(payload.uri)
      if (urip.collection === 'app.bsky.feed.post') {
        return `/profile/${urip.host}/post/${urip.rkey}`
      } else {
        return '/notifications'
      }
    }
    case 'follow':
    case 'starterpack-joined': {
      const urip = new AtUri(payload.uri)
      return `/profile/${urip.host}`
    }
    case 'chat-message':
    case 'chat-reaction':
    case 'chat-added-to-group':
    case 'chat-removed-from-group':
    case 'chat-join-request-rejected':
      // should be handled separately
      return null
    case 'verified':
    case 'unverified':
      return '/notifications'
    case 'krao-tip': {
      // The tipped post, or the tipper's profile for a profile tip
      const urip = new AtUri(payload.subject || payload.uri)
      if (urip.collection === 'app.bsky.feed.post') {
        return `/profile/${urip.host}/post/${urip.rkey}`
      }
      return `/profile/${urip.host}`
    }
    case 'krao-points':
    case 'krao-kyc':
      return '/settings/referral'
    default:
      // do nothing if we don't know what to do with it
      return null
  }
}
