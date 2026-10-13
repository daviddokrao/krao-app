import Svg, {type PathProps, type SvgProps} from 'react-native-svg'

import {KRAO_BRAND, KRAO_STAR} from '#/view/icons/kraoMark'
import {KraoStarShape} from '#/view/icons/KraoStarShape'
import {useTheme} from '#/alf'

export function Logomark({
  fill,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const t = useTheme()
  // @ts-expect-error it's fiiiiine
  const size = parseInt(rest.width || 32)
  const color = fill
    ? String(fill)
    : t.scheme === 'dark'
      ? KRAO_BRAND.greenOnDark
      : KRAO_BRAND.green

  return (
    <Svg
      fill="none"
      viewBox={KRAO_STAR.viewBox}
      {...rest}
      width={size}
      height={size}>
      <KraoStarShape color={color} small={size <= 48} />
    </Svg>
  )
}
