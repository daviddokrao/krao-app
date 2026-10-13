/*
 * Regenerates the app's raster brand assets (favicon, app icons, splash) from
 * the official Krao star in assets/brand. Run from the repo root after the
 * brand pack changes:
 *
 *   node scripts/krao-brand-assets.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

/** Keep in sync with src/view/icons/kraoMark.ts */
const GREEN = '#0E8C6E'
const GREEN_ON_DARK = '#17A886'
const YELLOW = '#FFC233'
const INK = '#16201A'
const WHITE = '#FFFFFF'
const TRIANGLES = [
  'M 100 38.9 L 152.91 130.55 L 47.09 130.55 Z',
  'M 139.27 53.19 L 120.9 157.42 L 39.83 89.39 Z',
  'M 160.17 89.39 L 79.1 157.42 L 60.73 53.19 Z',
]
/** Square box around the star (incl. miter joins) in its 200x200 space */
const STAR_BOX = {x: 28, y: 27, size: 144}

const root = path.resolve(import.meta.dirname, '..')
const out = p => path.join(root, p)

/**
 * SVG of the star centered in a w x h canvas, sized to `scale` of the
 * shorter side. `small` uses the heavier stroke meant for tiny sizes.
 */
function starSvg({w, h, scale, color, center = YELLOW, background, small}) {
  const target = Math.min(w, h) * scale
  const s = target / STAR_BOX.size
  const x = (w - target) / 2 - STAR_BOX.x * s
  const y = (h - target) / 2 - STAR_BOX.y * s
  const stroke = small ? 15 : 10.4
  const r = small ? 16 : 19
  const bg = background
    ? `<rect width="${w}" height="${h}" fill="${background}"/>`
    : ''
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      ${bg}
      <g transform="translate(${x} ${y}) scale(${s})">
        <circle cx="100" cy="100" r="${r}" fill="${center}"/>
        <g fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linejoin="miter">
          ${TRIANGLES.map(d => `<path d="${d}"/>`).join('')}
        </g>
      </g>
    </svg>`,
  )
}

async function write(file, opts) {
  await sharp(starSvg(opts)).png().toFile(out(file))
  console.log(`  ${file} (${opts.w}x${opts.h})`)
}

/** Same look as assets/brand/apple-touch-icon-180.png */
const appIcon = {scale: 0.66, color: WHITE, background: GREEN}
const appIconDark = {scale: 0.66, color: GREEN_ON_DARK, background: INK}

console.log('Generating Krao brand assets:')

// Web
// The official pack already has a hand-tuned 64px icon
fs.copyFileSync(out('assets/brand/krao-icon-64.png'), out('assets/favicon.png'))
console.log('  assets/favicon.png (copied from assets/brand)')
await write('assets/logo.png', {w: 500, h: 441, scale: 1, color: GREEN})

// App icons, including every alternate icon so no upstream artwork remains
await write('assets/app-icons/ios_icon_default_next.png', {
  w: 1024,
  h: 1024,
  ...appIcon,
})
await write('assets/app-icons/android_icon_default_next.png', {
  w: 1025,
  h: 1024,
  ...appIcon,
})
for (const platform of ['ios', 'android']) {
  const w = platform === 'android' ? 1025 : 1024
  await write(`assets/app-icons/${platform}_icon_legacy_light.png`, {
    w,
    h: 1024,
    ...appIcon,
  })
  await write(`assets/app-icons/${platform}_icon_legacy_dark.png`, {
    w,
    h: 1024,
    ...appIconDark,
  })
  for (const file of fs.readdirSync(out('assets/app-icons'))) {
    if (file.startsWith(`${platform}_icon_core_`)) {
      const {width, height} = await sharp(
        out(`assets/app-icons/${file}`),
      ).metadata()
      await write(`assets/app-icons/${file}`, {w: width, h: height, ...appIcon})
    }
  }
}

// iOS Icon Composer bundles: white star layer over the brand green fill
for (const bundle of ['ios_icon_default.icon', 'ios_icon_testflight.icon']) {
  const layer = `assets/app-icons/${bundle}/Assets/iOS transparent.png`
  const {width, height} = await sharp(out(layer)).metadata()
  await write(layer, {w: width, h: height, scale: 0.66, color: WHITE})
  const jsonFile = out(`assets/app-icons/${bundle}/icon.json`)
  const json = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
  json.fill = {'automatic-gradient': 'srgb:0.05490,0.54902,0.43137,1.00000'}
  fs.writeFileSync(jsonFile, JSON.stringify(json, null, 2) + '\n')
}

// Android adaptive icon layers (star stays inside the 66% safe zone).
// Monochrome and notification icons must be a single color.
await write('assets/icon-android-foreground.png', {
  w: 1024,
  h: 1024,
  scale: 0.5,
  color: WHITE,
})
await write('assets/icon-android-monochrome.png', {
  w: 1024,
  h: 1024,
  scale: 0.5,
  color: WHITE,
  center: WHITE,
})
await write('assets/icon-android-notification.png', {
  w: 96,
  h: 96,
  scale: 0.9,
  color: WHITE,
  center: WHITE,
  small: true,
})

// Splash screens
await write('assets/splash/splash.png', {
  w: 1170,
  h: 2529,
  scale: 0.28,
  color: WHITE,
  background: GREEN,
})
await write('assets/splash/splash-dark.png', {
  w: 1170,
  h: 2529,
  scale: 0.28,
  color: GREEN_ON_DARK,
  background: INK,
})
await write('assets/splash/android-splash-logo-white.png', {
  w: 306,
  h: 271,
  scale: 1,
  color: WHITE,
})

console.log('Done.')
