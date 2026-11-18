import {type StyleProp, type TextStyle} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * Said wherever points are shown (Decree 147 and Krao's terms): points are
 * not money, and are not for sale or transfer.
 */
export function PointsNote({style}: {style?: StyleProp<TextStyle>}) {
  const t = useTheme()
  return (
    <Text
      testID="pointsNote"
      style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium, style]}>
      <Trans>Points have no monetary value and cannot be transferred.</Trans>
    </Text>
  )
}
