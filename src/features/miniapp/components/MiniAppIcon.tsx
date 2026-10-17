import {View} from 'react-native'
import {Image} from 'expo-image'

import {atoms as a} from '#/alf'
import {Text} from '#/components/Typography'

const TILE_HUES = [215, 160, 28, 285, 340, 190, 95, 250]

/**
 * The app's icon (already served through Krao's image proxy), or a tile with
 * the first letters of its name in a color taken from its uri.
 */
export function MiniAppIcon({
  name,
  uri,
  iconUrl,
  size = 48,
}: {
  name: string
  uri: string
  iconUrl?: string
  size?: number
}) {
  if (iconUrl) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        source={{uri: iconUrl}}
        style={[{width: size, height: size, borderRadius: size / 4}]}
        contentFit="cover"
      />
    )
  }
  let hash = 0
  for (const ch of uri) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const hue = TILE_HUES[Math.abs(hash) % TILE_HUES.length]
  const initials = [...name.trim().split(/\s+/).slice(0, 2).join(' ')]
    .filter((ch, i, all) => i === 0 || all[i - 1] === ' ')
    .join('')
    .toUpperCase()
  return (
    <View
      accessible={false}
      style={[
        a.align_center,
        a.justify_center,
        {
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: `hsl(${hue} 55% 42%)`,
        },
      ]}>
      <Text
        emoji
        style={[a.font_bold, {color: '#fff', fontSize: size * 0.38}]}
        maxFontSizeMultiplier={1.2}>
        {initials || '#'}
      </Text>
    </View>
  )
}
