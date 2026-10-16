import {useState} from 'react'
import {type LayoutChangeEvent, View} from 'react-native'
import Svg, {Path} from 'react-native-svg'
import {Trans, useLingui} from '@lingui/react/macro'

import {cleanError} from '#/lib/strings/errors'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {buildChartPath, formatUsd} from '../logic'
import {type PriceRange, usePriceHistoryQuery} from '../queries'

const HEIGHT = 160

/** A plain line chart of the price over `range`, with low and high below it */
export function PriceChart({
  symbol,
  range,
}: {
  symbol: string
  range: PriceRange
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [width, setWidth] = useState(0)
  const history = usePriceHistoryQuery(symbol, range)
  const points = history.data ?? []

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width)

  const path = buildChartPath(points, width, HEIGHT)
  const prices = points.map(p => Number(p.priceUsd)).filter(Number.isFinite)
  const first = prices[0]
  const last = prices[prices.length - 1]
  const color = last >= first ? t.palette.positive_500 : t.palette.negative_500
  const from = formatUsd(first)
  const to = formatUsd(last)
  const low = formatUsd(Math.min(...prices))
  const high = formatUsd(Math.max(...prices))

  return (
    <View testID="tokenPriceChart" style={[a.gap_sm]}>
      <View
        onLayout={onLayout}
        style={[a.justify_center, a.align_center, {height: HEIGHT}]}>
        {history.isLoading ? (
          <Loader size="xl" />
        ) : history.isError ? (
          <View style={[a.gap_md, a.align_center]}>
            <Text
              style={[a.text_sm, a.text_center, t.atoms.text_contrast_medium]}>
              {cleanError(history.error)}
            </Text>
            <Button
              label={l`Try again`}
              color="secondary"
              size="small"
              onPress={() => void history.refetch()}>
              <ButtonText>
                <Trans>Try again</Trans>
              </ButtonText>
            </Button>
          </View>
        ) : path ? (
          <Svg
            width={width}
            height={HEIGHT}
            accessibilityRole="image"
            accessibilityHint=""
            accessibilityLabel={l`Price chart: from ${from} to ${to}, low ${low}, high ${high}`}>
            <Path
              d={path}
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        ) : (
          <Text
            style={[a.text_sm, a.text_center, t.atoms.text_contrast_medium]}>
            <Trans>Not enough price data for this period yet.</Trans>
          </Text>
        )}
      </View>
      {path ? (
        <View style={[a.flex_row, a.justify_between]}>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>Low {low}</Trans>
          </Text>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>High {high}</Trans>
          </Text>
        </View>
      ) : null}
    </View>
  )
}
