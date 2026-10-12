import {
  createThemes,
  DEFAULT_PALETTE,
  DEFAULT_SUBDUED_PALETTE,
} from '@bsky.app/alf'

/**
 * Krao brand color scale, replacing the upstream blue `primary_*` values.
 * Placeholder violet until the final brand colors are decided.
 */
export const KRAO_PRIMARY = {
  primary_25: '#F9F6FF',
  primary_50: '#F1EBFE',
  primary_100: '#E3D8FD',
  primary_200: '#CBB5FB',
  primary_300: '#AE8CF8',
  primary_400: '#9466F6',
  primary_500: '#7B3FF2',
  primary_600: '#6A2BDB',
  primary_700: '#5821B5',
  primary_800: '#461A8F',
  primary_900: '#33136A',
  primary_950: '#260E4F',
  primary_975: '#1A0938',
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
