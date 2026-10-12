import {Platform} from 'react-native'

/**
 * Placeholder Krao mark: a hexagon with a K cut out of it, drawn in a 64x57
 * box. Must be rendered with `fillRule="evenodd"`.
 */
export const KRAO_MARK_PATH =
  'M16 0h32l16 28.5L48 57H16L0 28.5 16 0Zm6 13v31h7V32l9 12h8.5L35 28.5 46.5 13H38l-9 12V13h-7Z'

/** Wordmark text, rendered with the app's Inter font until a final logotype exists. */
export const KRAO_WORDMARK = 'Krao'

/** Inter is registered as a variable font on web/iOS and as static files on Android. */
export const KRAO_WORDMARK_FONT =
  Platform.OS === 'android' ? 'Inter-Bold' : 'InterVariable'
