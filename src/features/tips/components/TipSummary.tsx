import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {formatUnits, getTipAsset} from '../assets'
import {type TipTotal, useTipsQuery, useTipTotalsQuery} from '../queries'

/**
 * Verified tip totals for a post, eg "💎 Tipped 0.01 ETH · 5 USDC (2)".
 * Renders nothing until the post has a verified tip.
 */
export function TipSummary({uri}: {uri: string}) {
  const {data} = useTipsQuery(uri)
  return <TipTotalsLine totals={data?.totals ?? []} />
}

/** {@link TipSummary} for feed items, batched across the visible posts */
export function FeedTipSummary({uri}: {uri: string}) {
  const {data} = useTipTotalsQuery(uri)
  return <TipTotalsLine totals={data ?? []} compact />
}

function TipTotalsLine({
  totals: allTotals,
  compact = false,
}: {
  totals: TipTotal[]
  /** Tighter spacing and smaller text, for feeds */
  compact?: boolean
}) {
  const t = useTheme()
  const totals = allTotals.filter(total => getTipAsset(total.asset))
  if (!totals.length) return null

  const count = totals.reduce((sum, total) => sum + total.count, 0)
  const amounts = totals
    .map(total => {
      const asset = getTipAsset(total.asset)!
      return `${formatUnits(total.amount, asset.decimals)} ${asset.symbol}`
    })
    .join(' · ')

  return (
    <View
      testID="tipSummary"
      style={[
        a.flex_row,
        a.align_center,
        a.gap_xs,
        compact ? a.pt_xs : a.py_xs,
      ]}>
      <Text
        style={[compact ? a.text_xs : a.text_sm, t.atoms.text_contrast_medium]}>
        💎{' '}
        <Trans>
          Tipped {amounts} ({count})
        </Trans>
      </Text>
    </View>
  )
}
