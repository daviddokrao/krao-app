import Svg, {type PathProps, type SvgProps, Text} from 'react-native-svg'

import {usePalette} from '#/lib/hooks/usePalette'
import {KRAO_WORDMARK, KRAO_WORDMARK_FONT} from '#/view/icons/kraoMark'

const ratio = 17 / 64

export function Logotype({
  fill,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const pal = usePalette('default')
  // @ts-expect-error it's fiiiiine
  const size = parseInt(rest.width || 32)

  return (
    <Svg
      fill="none"
      viewBox="0 0 64 17"
      {...rest}
      width={size}
      height={Number(size) * ratio}>
      <Text
        fill={fill || pal.text.color}
        x={32}
        y={15}
        textAnchor="middle"
        fontSize={19}
        fontWeight="700"
        fontFamily={KRAO_WORDMARK_FONT}
        letterSpacing={-0.66}>
        {KRAO_WORDMARK}
      </Text>
    </Svg>
  )
}
