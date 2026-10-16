import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {formatUsdc} from '../logic'

/**
 * One membership plan: name, price per 30 days, description and perks. Actions
 * (join, edit) go in `children`.
 */
export function PlanCard({
  name,
  description,
  priceUsdc,
  perks,
  memberCount,
  inactive,
  highlight,
  children,
}: {
  name: string
  description?: string
  priceUsdc: string
  perks?: string[]
  /** Shown to the creator only */
  memberCount?: number
  inactive?: boolean
  highlight?: boolean
  children?: React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const price = formatUsdc(priceUsdc)
  return (
    <View
      style={[
        a.p_lg,
        a.gap_sm,
        a.rounded_md,
        a.border,
        highlight
          ? {borderColor: t.palette.primary_500}
          : t.atoms.border_contrast_low,
        inactive && {opacity: 0.7},
      ]}>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
        <Text emoji style={[a.flex_1, a.text_lg, a.font_semi_bold]}>
          {name}
        </Text>
        <Text
          accessibilityLabel={l`${price} USDC per 30 days`}
          accessibilityHint=""
          style={[a.text_md, a.font_semi_bold]}>
          {price} USDC
        </Text>
      </View>
      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
        <Trans>per 30 days</Trans>
        {memberCount !== undefined && (
          <>
            {' · '}
            {plural(memberCount, {one: '# member', other: '# members'})}
          </>
        )}
        {inactive && (
          <>
            {' · '}
            <Trans>Not active</Trans>
          </>
        )}
      </Text>
      {!!description && (
        <Text emoji style={[a.text_md, a.leading_snug]}>
          {description}
        </Text>
      )}
      {!!perks?.length && (
        <View style={[a.gap_2xs]}>
          {perks.map(perk => (
            <View key={perk} style={[a.flex_row, a.gap_sm]}>
              <Text style={[{color: t.palette.primary_600}]}>✓</Text>
              <Text emoji style={[a.flex_1, a.text_md, a.leading_snug]}>
                {perk}
              </Text>
            </View>
          ))}
        </View>
      )}
      {children}
    </View>
  )
}
