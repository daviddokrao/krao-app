import {Circle, G, Path} from 'react-native-svg'

import {KRAO_BRAND, KRAO_STAR} from '#/view/icons/kraoMark'

/**
 * The Krao star as SVG children, for use inside an `<Svg>` whose viewBox is
 * `KRAO_STAR.viewBox` (or any box in the star's 200x200 coordinate space).
 */
export function KraoStarShape({
  color = KRAO_BRAND.green,
  centerColor = KRAO_BRAND.yellow,
  small = false,
}: {
  color?: string
  centerColor?: string
  /** Use the heavier stroke that stays legible at 48px and below */
  small?: boolean
}) {
  const weight = small ? KRAO_STAR.small : KRAO_STAR.regular
  return (
    <>
      <Circle cx={100} cy={100} r={weight.centerRadius} fill={centerColor} />
      <G
        fill="none"
        stroke={color}
        strokeWidth={weight.strokeWidth}
        strokeLinejoin="miter">
        {KRAO_STAR.triangles.map(d => (
          <Path key={d} d={d} />
        ))}
      </G>
    </>
  )
}
