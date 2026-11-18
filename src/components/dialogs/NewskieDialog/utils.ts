import {type I18n} from '@lingui/core'
import {msg} from '@lingui/core/macro'

import {BRAND_NAME} from '#/lib/brand'
import {dateDiff, formatDateDiff} from '#/lib/hooks/useTimeAgo'

export function getJoinMessage({
  i18n,
  profileName,
  isMe,
  joinedViaStarterPack,
  createdAt,
  now,
}: {
  i18n: I18n
  profileName: string
  isMe: boolean
  joinedViaStarterPack: boolean
  createdAt: string
  now: number
}): string {
  const diff = dateDiff(createdAt, now)

  if (diff.unit === 'now') {
    if (isMe) {
      return joinedViaStarterPack
        ? i18n._(msg`You joined ${BRAND_NAME} using a Starter Pack just now`)
        : i18n._(msg`You joined ${BRAND_NAME} just now`)
    }

    return joinedViaStarterPack
      ? i18n._(
          msg`${profileName} joined ${BRAND_NAME} using a Starter Pack just now`,
        )
      : i18n._(msg`${profileName} joined ${BRAND_NAME} just now`)
  }

  const timeAgoString = formatDateDiff({diff, i18n, format: 'long'})

  if (isMe) {
    return joinedViaStarterPack
      ? i18n._(
          msg`You joined ${BRAND_NAME} using a Starter Pack ${timeAgoString} ago`,
        )
      : i18n._(msg`You joined ${BRAND_NAME} ${timeAgoString} ago`)
  }

  return joinedViaStarterPack
    ? i18n._(
        msg`${profileName} joined ${BRAND_NAME} using a Starter Pack ${timeAgoString} ago`,
      )
    : i18n._(msg`${profileName} joined ${BRAND_NAME} ${timeAgoString} ago`)
}
