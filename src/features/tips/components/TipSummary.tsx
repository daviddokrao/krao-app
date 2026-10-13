import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {formatUnits, getTipAsset} from '../assets'
import {useTipsQuery} from '../queries'

/**
 * Verified tip totals for a post, eg "💎 Tipped 0.01 ETH · 5 USDC (2)".
 * Renders nothing until the post has a verified tip.
 */
export function TipSummary({uri}: {uri: string}) {
  const t = useTheme()
  const {data} = useTipsQuery(uri)
  const totals = (data?.totals ?? []).filter(total => getTipAsset(total.asset))
  if (!totals.length) return null

  const count = totals.reduce((sum, total) => sum + total.count, 0)
  const amounts = totals
    .map(total => {
      const asset = getTipAsset(total.asset)!
      return `${formatUnits(total.amount, asset.decimals)} ${asset.symbol}`
    })
    .join(' · ')

  return (
    <View style={[a.flex_row, a.align_center, a.gap_xs, a.py_xs]}>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        💎{' '}
        <Trans>
          Tipped {amounts} ({count})
        </Trans>
      </Text>
    </View>
  )
}
