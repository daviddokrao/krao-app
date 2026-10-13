import Svg, {G, type PathProps, type SvgProps, Text} from 'react-native-svg'

import {
  KRAO_BRAND,
  KRAO_WORDMARK,
  KRAO_WORDMARK_FONT,
} from '#/view/icons/kraoMark'
import {KraoStarShape} from '#/view/icons/KraoStarShape'
import {useTheme} from '#/alf'

/** Horizontal lockup, laid out like assets/brand/krao-lockup-horizontal.svg */
const ratio = 100 / 320

export function LogomarkWithType({
  fill,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const t = useTheme()
  const size = parseInt(`${rest.width || 32}`)
  const isDark = t.scheme === 'dark'

  return (
    <Svg
      fill="none"
      viewBox="0 0 320 100"
      {...rest}
      width={size}
      height={Number(size) * ratio}>
      <G transform="translate(0,10) scale(0.4)">
        <KraoStarShape
          color={
            fill
              ? String(fill)
              : isDark
                ? KRAO_BRAND.greenOnDark
                : KRAO_BRAND.green
          }
        />
      </G>
      <Text
        fill={fill || (isDark ? t.atoms.text.color : KRAO_BRAND.ink)}
        x={97}
        y={63}
        fontSize={42}
        fontWeight="700"
        fontFamily={KRAO_WORDMARK_FONT}
        letterSpacing={-1.5}>
        {KRAO_WORDMARK}
      </Text>
    </Svg>
  )
}
