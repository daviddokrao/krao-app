import Svg, {
  G,
  Path,
  type PathProps,
  type SvgProps,
  Text,
} from 'react-native-svg'

import {
  KRAO_MARK_PATH,
  KRAO_WORDMARK,
  KRAO_WORDMARK_FONT,
} from '#/view/icons/kraoMark'
import {useTheme} from '#/alf'

const ratio = 31 / 136

export function LogomarkWithType({
  fill,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const t = useTheme()
  const size = parseInt(`${rest.width || 32}`)

  return (
    <Svg
      fill="none"
      viewBox="0 0 136 31"
      {...rest}
      width={size}
      height={Number(size) * ratio}>
      <G transform="scale(0.5439)">
        <Path
          fill={fill || t.atoms.text.color}
          fillRule="evenodd"
          d={KRAO_MARK_PATH}
        />
      </G>
      <Text
        fill={fill || t.atoms.text.color}
        x={44}
        y={25}
        fontSize={30}
        fontWeight="800"
        fontFamily={KRAO_WORDMARK_FONT}
        letterSpacing={-1}>
        {KRAO_WORDMARK}
      </Text>
    </Svg>
  )
}
