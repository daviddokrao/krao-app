import {Platform} from 'react-native'

/**
 * Official Krao brand colors (see assets/brand/README.md).
 */
export const KRAO_BRAND = {
  /** Star on light backgrounds */
  green: '#0E8C6E',
  /** Star on dark backgrounds */
  greenOnDark: '#17A886',
  /** Center dot */
  yellow: '#FFC233',
  /** Wordmark ink */
  ink: '#16201A',
} as const

/**
 * The Krao star: three stroked triangles around a yellow dot, drawn in the
 * 200x200 box of assets/brand/krao-icon.svg. Never rotate, recolor with
 * gradients, or change the stroke weight (brand rules).
 */
export const KRAO_STAR = {
  triangles: [
    'M 100 38.9 L 152.91 130.55 L 47.09 130.55 Z',
    'M 139.27 53.19 L 120.9 157.42 L 39.83 89.39 Z',
    'M 160.17 89.39 L 79.1 157.42 L 60.73 53.19 Z',
  ],
  /** Standard weight, for 24px and up */
  regular: {strokeWidth: 10.4, centerRadius: 19},
  /** Heavier weight for 48px and below (krao-icon-small.svg) */
  small: {strokeWidth: 15, centerRadius: 16},
  /** Square box tightly around the star, including miter joins */
  viewBox: '28 27 144 144',
} as const

/** Wordmark text; the brand font is Sora 700 with -0.035em tracking. */
export const KRAO_WORDMARK = 'Krao'

/**
 * Sora Bold (assets/fonts/sora, OFL), used only for the wordmark. Web gets a
 * CSS fallback stack; native resolves it by its PostScript/file name.
 */
export const KRAO_WORDMARK_FONT = Platform.select({
  web: 'Sora, InterVariable, sans-serif',
  default: 'Sora-Bold',
})
