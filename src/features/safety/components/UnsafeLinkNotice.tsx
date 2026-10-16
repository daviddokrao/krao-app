import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Warning_Stroke2_Corner0_Rounded as WarningIcon} from '#/components/icons/Warning'
import {Text} from '#/components/Typography'
import {useLinkSafetyQuery} from '../queries'

/**
 * A small warning on a link card whose site is on Krao's scam list. Nothing
 * for any other link, and while the answer is not in.
 */
export function UnsafeLinkNotice({url}: {url: string}) {
  const t = useTheme()
  const {data} = useLinkSafetyQuery(url)
  if (!data?.unsafe) return null
  return (
    <View
      testID="unsafeLinkNotice"
      style={[a.flex_row, a.align_center, a.gap_xs, a.pt_sm]}>
      <WarningIcon fill={t.palette.negative_500} size="sm" />
      <Text
        style={[
          a.flex_1,
          a.text_xs,
          a.font_semi_bold,
          a.leading_snug,
          {color: t.palette.negative_500},
        ]}>
        <Trans>This site is on a scam list</Trans>
      </Text>
    </View>
  )
}
