import {type StyleProp, type TextStyle} from 'react-native'

import {atoms as a, useTheme, web} from '#/alf'
import {Text} from '#/components/Typography'
import {splitAddress} from '../addresses'

/**
 * A full address with its first 6 and last 4 characters set apart: those
 * are the ones people compare, and the ones a lookalike copies. The middle
 * is there in full too, so the whole address can be checked.
 */
export function AddressDisplay({
  address,
  style,
}: {
  address: string
  style?: StyleProp<TextStyle>
}) {
  const t = useTheme()
  const {head, middle, tail} = splitAddress(address)
  const strong = [a.font_bold, {color: t.palette.primary_600}]
  return (
    <Text
      testID="addressDisplay"
      selectable
      style={[
        a.text_sm,
        a.leading_snug,
        t.atoms.text_contrast_medium,
        web({wordBreak: 'break-all'}),
        style,
      ]}>
      <Text style={[a.text_sm, strong]}>{head}</Text>
      {middle}
      <Text style={[a.text_sm, strong]}>{tail}</Text>
    </Text>
  )
}
