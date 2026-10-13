import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {useChainProfileQuery} from '../queries'

/**
 * Small hexagon over the corner of an avatar whose picture is an NFT the
 * account verifiably holds. Place inside a relatively positioned wrapper
 * around the avatar.
 */
export function NftAvatarMark({did, size = 18}: {did: string; size?: number}) {
  const t = useTheme()
  const {data} = useChainProfileQuery(did)
  if (data?.nftAvatar?.status !== 'verified') return null

  return (
    <View
      testID="nftAvatarMark"
      // Decorative: the profile's "NFT avatar" badge carries the meaning
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        a.absolute,
        a.align_center,
        a.justify_center,
        a.rounded_full,
        a.border,
        {
          right: -3,
          bottom: -3,
          width: size,
          height: size,
          backgroundColor: t.palette.primary_500,
          borderColor: t.atoms.bg.backgroundColor,
          borderWidth: 2,
        },
      ]}>
      <Text
        style={[
          a.font_bold,
          {
            color: t.palette.white,
            fontSize: size * 0.55,
            lineHeight: size * 0.7,
          },
        ]}>
        ⬡
      </Text>
    </View>
  )
}
