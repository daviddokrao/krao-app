import {
  createThemes,
  DEFAULT_PALETTE,
  DEFAULT_SUBDUED_PALETTE,
} from '@bsky.app/alf'

/**
 * Krao brand color scale (jade green #0E8C6E, see assets/brand/README.md),
 * replacing the upstream blue `primary_*` values.
 */
export const KRAO_PRIMARY = {
  primary_25: '#F3FBF8',
  primary_50: '#E6F6F1',
  primary_100: '#C7EBDF',
  primary_200: '#9ADBC6',
  primary_300: '#5FC4A6',
  primary_400: '#17A886',
  primary_500: '#0E8C6E',
  primary_600: '#0B755C',
  primary_700: '#095F4B',
  primary_800: '#074A3A',
  primary_900: '#05362A',
  primary_950: '#04271F',
  primary_975: '#031B15',
} as const

const DEFAULT_THEMES = createThemes({
  defaultPalette: {...DEFAULT_PALETTE, ...KRAO_PRIMARY},
  subduedPalette: {...DEFAULT_SUBDUED_PALETTE, ...KRAO_PRIMARY},
})

export const themes = {
  lightPalette: DEFAULT_THEMES.light.palette,
  darkPalette: DEFAULT_THEMES.dark.palette,
  dimPalette: DEFAULT_THEMES.dim.palette,
  light: DEFAULT_THEMES.light,
  dark: DEFAULT_THEMES.dark,
  dim: DEFAULT_THEMES.dim,
}

/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const lightPalette = DEFAULT_THEMES.light.palette
/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const darkPalette = DEFAULT_THEMES.dark.palette
/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const dimPalette = DEFAULT_THEMES.dim.palette
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const light = DEFAULT_THEMES.light
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const dark = DEFAULT_THEMES.dark
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const dim = DEFAULT_THEMES.dim
