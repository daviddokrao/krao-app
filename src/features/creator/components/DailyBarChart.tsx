import {useState} from 'react'
import {type LayoutChangeEvent, View} from 'react-native'
import Svg, {Rect} from 'react-native-svg'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {buildBars} from '#/features/membership/logic'

const HEIGHT = 120

/**
 * A plain column chart of one value per day. `label` is read out by screen
 * readers in place of the bars, with the first and last day below the chart.
 */
export function DailyBarChart({
  values,
  firstLabel,
  lastLabel,
  label,
}: {
  values: number[]
  firstLabel: string
  lastLabel: string
  label: string
}) {
  const t = useTheme()
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width)
  const bars = buildBars(values, width, HEIGHT)

  return (
    <View testID="creatorDailyChart" style={[a.gap_xs]}>
      <View onLayout={onLayout} style={{height: HEIGHT}}>
        {width > 0 && (
          <Svg
            width={width}
            height={HEIGHT}
            accessibilityRole="image"
            accessibilityHint=""
            accessibilityLabel={label}>
            {/* A baseline, so days without activity still read as a chart */}
            <Rect
              x={0}
              y={HEIGHT - 1}
              width={width}
              height={1}
              fill={t.palette.contrast_100}
            />
            {bars.map((bar, i) => (
              <Rect
                key={i}
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                rx={Math.min(2, bar.width / 2)}
                fill={t.palette.primary_500}
              />
            ))}
          </Svg>
        )}
      </View>
      <View style={[a.flex_row, a.justify_between]}>
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          {firstLabel}
        </Text>
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          {lastLabel}
        </Text>
      </View>
    </View>
  )
}
