import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Shield_Stroke2_Corner0_Rounded as ShieldIcon} from '#/components/icons/Shield'
import {Text} from '#/components/Typography'

/** In a conversation: what Krao will never ask for in a message */
export function DmSafetyBanner() {
  const t = useTheme()
  return (
    <View
      testID="dmSafetyBanner"
      style={[
        a.flex_row,
        a.align_start,
        a.gap_sm,
        a.mx_lg,
        a.mt_md,
        a.p_md,
        a.rounded_md,
        t.atoms.bg_contrast_25,
      ]}>
      <ShieldIcon fill={t.palette.primary_500} size="md" />
      <Text
        style={[
          a.flex_1,
          a.text_sm,
          a.leading_snug,
          t.atoms.text_contrast_high,
        ]}>
        <Trans>
          Krao never asks for your seed phrase, private key or a signature in a
          message.
        </Trans>
      </Text>
    </View>
  )
}
