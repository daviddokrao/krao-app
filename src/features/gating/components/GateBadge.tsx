import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {useDescribeRule} from '../describe'
import {useGateRuleQuery} from '../queries'

/**
 * Marks a token-gated post in feeds. The content itself only loads in the
 * thread view, so feeds don't ask the gate service once per post.
 */
export function GateBadge({uri}: {uri: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const describeRule = useDescribeRule()
  const {data: rule} = useGateRuleQuery(uri)
  if (!rule?.hasContent) return null

  return (
    <View
      testID="gateBadge"
      style={[
        a.flex_row,
        a.self_start,
        a.mt_xs,
        a.px_sm,
        a.py_2xs,
        a.rounded_full,
        {backgroundColor: t.palette.primary_50},
      ]}>
      <Text
        numberOfLines={1}
        // The label leaves the emoji out: screen readers would read it aloud
        accessibilityLabel={l`Token-gated · holders of ${describeRule(rule)}`}
        accessibilityHint=""
        style={[a.text_xs, a.font_semi_bold, {color: t.palette.primary_700}]}>
        🔒 <Trans>Token-gated · holders of {describeRule(rule)}</Trans>
      </Text>
    </View>
  )
}
