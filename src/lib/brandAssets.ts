/**
 * Every logo / brand image file the app code loads. A rebrand swaps these
 * files (same names and sizes) and leaves the code alone. The app icons and
 * the native splash are listed in `app.config.js`; the full logo set is in
 * `assets/brand/`.
 */
export const BRAND_ASSETS = {
  /** Mark drawn in the middle of QR codes and used as the default QR avatar */
  qrLogo: require('../../assets/logo.png'),
  /** Splash image, light and dark (also the native splash in app.config.js) */
  splash: require('../../assets/splash/splash.png'),
  splashDark: require('../../assets/splash/splash-dark.png'),
}
