import {type StyleProp, type TextStyle} from 'react-native'

import {useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {changeDirection, formatPercent} from '../logic'

/** The 24h change in percent: green up, red down, neutral when flat */
export function Change({
  value,
  style,
}: {
  value: string | undefined
  style?: StyleProp<TextStyle>
}) {
  const t = useTheme()
  const text = formatPercent(value)
  if (!text) return null
  const direction = changeDirection(value)
  const color =
    direction === 'up'
      ? t.palette.positive_600
      : direction === 'down'
        ? t.palette.negative_600
        : t.palette.contrast_500
  return <Text style={[style, {color}]}>{text}</Text>
}
