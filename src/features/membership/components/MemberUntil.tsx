import {type StyleProp, type TextStyle} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {describeExpiry} from '../logic'
import {type MembershipView} from '../queries'

/** "Member until Jun 3, 2026", or why the membership is not active */
export function useMembershipLine() {
  const {t: l, i18n} = useLingui()
  return (
    membership: Pick<MembershipView, 'status' | 'expiresAt' | 'reason'>,
  ): string => {
    const info = describeExpiry(membership.expiresAt, new Date())
    const date = membership.expiresAt
      ? i18n.date(new Date(membership.expiresAt), {dateStyle: 'medium'})
      : ''
    if (membership.status === 'pending') {
      return l`Confirming your payment…`
    }
    if (membership.status === 'invalid') {
      return membership.reason
        ? l`Payment not accepted: ${membership.reason}`
        : l`Payment not accepted`
    }
    if (membership.status === 'expired' || info?.expired) {
      return date ? l`Membership ended on ${date}` : l`Membership ended`
    }
    if (!date) return l`Member`
    const daysLeft = info?.daysLeft ?? 0
    return info?.renewSoon
      ? l`Member until ${date} (${plural(daysLeft, {one: '# day left', other: '# days left'})})`
      : l`Member until ${date}`
  }
}

export function MemberUntil({
  membership,
  style,
}: {
  membership: Pick<MembershipView, 'status' | 'expiresAt' | 'reason'>
  style?: StyleProp<TextStyle>
}) {
  const t = useTheme()
  const line = useMembershipLine()
  const info = describeExpiry(membership.expiresAt, new Date())
  const good = membership.status === 'active' && !info?.expired
  return (
    <Text
      style={[
        a.text_sm,
        good
          ? [a.font_semi_bold, {color: t.palette.primary_600}]
          : t.atoms.text_contrast_medium,
        style,
      ]}>
      {line(membership)}
    </Text>
  )
}
