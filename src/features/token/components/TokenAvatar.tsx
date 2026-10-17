import {View} from 'react-native'
import {Image} from 'expo-image'

import {atoms as a} from '#/alf'
import {Text} from '#/components/Typography'
import {safeLogoUri} from '../logic'

/** The token's logo, or its first letters on a tile when it has none */
export function TokenAvatar({
  symbol,
  logo,
  size = 48,
}: {
  symbol: string
  logo?: string
  size?: number
}) {
  const uri = safeLogoUri(logo)
  if (uri) {
    return (
      <Image
        accessible={false}
        source={{uri}}
        style={[a.rounded_full, {width: size, height: size}]}
        contentFit="cover"
      />
    )
  }
  return (
    <View
      accessible={false}
      style={[
        a.align_center,
        a.justify_center,
        a.rounded_full,
        {width: size, height: size, backgroundColor: 'hsl(215 55% 42%)'},
      ]}>
      <Text
        style={[a.font_bold, {color: '#fff', fontSize: size * 0.34}]}
        maxFontSizeMultiplier={1.2}>
        {symbol.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  )
}
