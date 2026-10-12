import Svg, {Path, type PathProps, type SvgProps} from 'react-native-svg'

import {usePalette} from '#/lib/hooks/usePalette'
import {KRAO_MARK_PATH} from '#/view/icons/kraoMark'

const ratio = 57 / 64

export function Logomark({
  fill,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const pal = usePalette('default')
  // @ts-expect-error it's fiiiiine
  const size = parseInt(rest.width || 32)

  return (
    <Svg
      fill="none"
      viewBox="0 0 64 57"
      {...rest}
      width={size}
      height={Number(size) * ratio}>
      <Path
        fill={fill || pal.text.color}
        fillRule="evenodd"
        d={KRAO_MARK_PATH}
      />
    </Svg>
  )
}
