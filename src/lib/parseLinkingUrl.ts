/** App URL schemes; `bluesky://` still arrives from older native modules. */
const APP_SCHEMES = ['krao://', 'bluesky://']

export function parseLinkingUrl(url: string): URL {
  /*
   * Hack: add a third slash to app scheme urls so that `URL.host` is empty and
   * `URL.pathname` has the full path.
   */
  for (const scheme of APP_SCHEMES) {
    if (url.startsWith(scheme) && !url.startsWith(`${scheme}/`)) {
      url = url.replace(scheme, `${scheme}/`)
      break
    }
  }
  return new URL(url)
}
