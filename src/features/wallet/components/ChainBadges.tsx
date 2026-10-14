import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {type BadgeId} from '../api'
import {useChainProfileQuery} from '../queries'

/**
 * Badges earned from verified on-chain activity (linked wallet, NFT avatar,
 * tips sent and received), shown under the profile handle.
 */
export function ChainBadges({did}: {did: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data} = useChainProfileQuery(did)
  const badges = data?.badges ?? []
  if (!badges.length) return null

  const labels: Record<BadgeId, (count?: number) => string> = {
    'wallet-verified': () => l`Verified wallet`,
    'nft-avatar': () => l`NFT avatar`,
    tipper: count => l`Tipper · ${count ?? 0}`,
    supported: count => l`Supported · ${count ?? 0}`,
  }
  const icons: Record<BadgeId, string> = {
    'wallet-verified': '🔗',
    'nft-avatar': '⬡',
    tipper: '💎',
    supported: '✨',
  }

  return (
    <View
      style={[a.flex_row, a.flex_wrap, a.gap_xs, a.pt_xs]}
      accessibilityRole="list"
      accessibilityLabel={l`On-chain badges`}
      accessibilityHint="">
      {badges.map(badge => {
        const id = badge.id as BadgeId
        if (!labels[id]) return null
        return (
          <View
            key={badge.id}
            // One label per badge, so the emoji is not read out on its own
            accessible
            accessibilityLabel={labels[id](badge.count)}
            accessibilityHint=""
            style={[
              a.flex_row,
              a.align_center,
              a.gap_2xs,
              a.px_sm,
              a.py_2xs,
              a.rounded_full,
              {backgroundColor: t.palette.primary_50},
            ]}>
            <Text style={[a.text_xs]}>{icons[id]}</Text>
            <Text
              style={[
                a.text_xs,
                a.font_semi_bold,
                {color: t.palette.primary_700},
              ]}>
              {labels[id](badge.count)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
