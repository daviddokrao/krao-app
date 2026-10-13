import {forwardRef} from 'react'
import {type TextProps} from 'react-native'
import Svg, {type PathProps, type SvgProps} from 'react-native-svg'

import {KRAO_BRAND, KRAO_STAR} from '#/view/icons/kraoMark'
import {KraoStarShape} from '#/view/icons/KraoStarShape'
import {flatten, useTheme} from '#/alf'

type Props = {
  allowVariants?: boolean
  /**
   * Star color. The legacy 'sky' gradient value maps to the brand green,
   * since the brand rules do not allow gradients on the mark.
   */
  fill?: PathProps['fill']
  style?: TextProps['style']
} & Omit<SvgProps, 'style'>

export const Logo = forwardRef(function LogoImpl(props: Props, ref) {
  const t = useTheme()
  const {allowVariants: _allowVariants, fill, ...rest} = props
  const styles = flatten(props.style)
  const brandColor =
    t.scheme === 'dark' ? KRAO_BRAND.greenOnDark : KRAO_BRAND.green
  const color =
    !fill || fill === 'sky'
      ? typeof styles?.color === 'string'
        ? styles.color
        : brandColor
      : String(fill)
  // @ts-expect-error it's fiiiiine
  const size = parseInt(rest.width || 32, 10)

  return (
    <Svg
      fill="none"
      // @ts-expect-error it's fiiiiine
      ref={ref}
      viewBox={KRAO_STAR.viewBox}
      accessibilityLabel="Krao"
      accessibilityHint=""
      {...rest}
      style={[{width: size, height: size}, styles]}>
      <KraoStarShape color={color} small={size <= 48} />
    </Svg>
  )
})
