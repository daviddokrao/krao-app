import {forwardRef} from 'react'
import {type TextProps} from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  Path,
  type PathProps,
  Stop,
  type SvgProps,
} from 'react-native-svg'
import {Image} from 'expo-image'

import {KRAO_MARK_PATH} from '#/view/icons/kraoMark'
import {useLogoVariant} from '#/view/icons/useLogoVariant'
import {flatten, useTheme} from '#/alf'

const ratio = 57 / 64

type Props = {
  allowVariants?: boolean
  fill?: PathProps['fill']
  style?: TextProps['style']
} & Omit<SvgProps, 'style'>

export const Logo = forwardRef(function LogoImpl(props: Props, ref) {
  const t = useTheme()
  const {allowVariants = true, fill, ...rest} = props
  const gradient = fill === 'sky'
  const styles = flatten(props.style)
  const _fill = gradient
    ? 'url(#sky)'
    : fill || styles?.color || t.palette.primary_500
  // @ts-expect-error it's fiiiiine
  const size = parseInt(rest.width || 32, 10)

  const logoVariant = useLogoVariant(allowVariants)

  if (logoVariant === 'kawaii') {
    return (
      <Image
        source={
          size > 100
            ? require('../../../assets/kawaii.png')
            : require('../../../assets/kawaii_smol.png')
        }
        accessibilityLabel="Krao"
        accessibilityHint=""
        accessibilityIgnoresInvertColors
        style={[{height: size, aspectRatio: 1.4}]}
      />
    )
  }

  return (
    <Svg
      fill="none"
      // @ts-expect-error it's fiiiiine
      ref={ref}
      viewBox="0 0 64 57"
      {...rest}
      style={[{width: size, height: size * ratio}, styles]}>
      {gradient && (
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#6A2BDB" stopOpacity="1" />
            <Stop offset="1" stopColor="#AE8CF8" stopOpacity="1" />
          </LinearGradient>
        </Defs>
      )}

      <Path fill={_fill} fillRule="evenodd" d={KRAO_MARK_PATH} />
    </Svg>
  )
})
