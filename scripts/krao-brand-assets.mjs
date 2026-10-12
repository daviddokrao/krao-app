/*
 * Regenerates the Krao raster brand assets (favicon, app icons, splash) from
 * the vector mark. Run from the repo root after changing the mark or colors:
 *
 *   node scripts/krao-brand-assets.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

/** Keep in sync with src/view/icons/kraoMark.ts and KRAO_PRIMARY in src/alf/themes.ts */
const MARK_PATH =
  'M16 0h32l16 28.5L48 57H16L0 28.5 16 0Zm6 13v31h7V32l9 12h8.5L35 28.5 46.5 13H38l-9 12V13h-7Z'
const PRIMARY_500 = '#7B3FF2'
const PRIMARY_600 = '#6A2BDB'
const PRIMARY_300 = '#AE8CF8'
const PRIMARY_900 = '#33136A'
const PRIMARY_975 = '#1A0938'

const root = path.resolve(import.meta.dirname, '..')
const out = p => path.join(root, p)

/** SVG of the mark, centered in a w x h canvas, scaled to `scale` of the width. */
function markSvg({w, h, scale, color, background}) {
  const markW = w * scale
  const s = markW / 64
  const x = (w - markW) / 2
  const y = (h - 57 * s) / 2
  const bg = !background
    ? ''
    : background.gradient
      ? `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="${background.gradient[0]}"/>
           <stop offset="1" stop-color="${background.gradient[1]}"/>
         </linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>`
      : `<rect width="${w}" height="${h}" fill="${background}"/>`
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      ${bg}
      <path transform="translate(${x} ${y}) scale(${s})" fill="${color}" fill-rule="evenodd" d="${MARK_PATH}"/>
    </svg>`,
  )
}

async function write(file, opts) {
  await sharp(markSvg(opts)).png().toFile(out(file))
  console.log(`  ${file} (${opts.w}x${opts.h})`)
}

const appIcon = {
  scale: 0.56,
  color: '#FFFFFF',
  background: {gradient: [PRIMARY_500, PRIMARY_600]},
}
const appIconDark = {
  scale: 0.56,
  color: PRIMARY_300,
  background: {gradient: [PRIMARY_900, PRIMARY_975]},
}

console.log('Generating Krao brand assets:')

// Web
await write('assets/favicon.png', {w: 64, h: 64, scale: 0.9, color: PRIMARY_500})
await write('assets/logo.png', {w: 500, h: 441, scale: 1, color: PRIMARY_500})

// App icons, including every alternate icon so no Bluesky artwork remains
await write('assets/app-icons/ios_icon_default_next.png', {w: 1024, h: 1024, ...appIcon})
await write('assets/app-icons/android_icon_default_next.png', {w: 1025, h: 1024, ...appIcon})
for (const platform of ['ios', 'android']) {
  const w = platform === 'android' ? 1025 : 1024
  await write(`assets/app-icons/${platform}_icon_legacy_light.png`, {w, h: 1024, ...appIcon})
  await write(`assets/app-icons/${platform}_icon_legacy_dark.png`, {w, h: 1024, ...appIconDark})
  for (const file of fs.readdirSync(out('assets/app-icons'))) {
    if (file.startsWith(`${platform}_icon_core_`)) {
      const {width, height} = await sharp(out(`assets/app-icons/${file}`)).metadata()
      await write(`assets/app-icons/${file}`, {w: width, h: height, ...appIcon})
    }
  }
}

// iOS Icon Composer bundles: white mark layer over the primary fill
for (const bundle of ['ios_icon_default.icon', 'ios_icon_testflight.icon']) {
  const layer = `assets/app-icons/${bundle}/Assets/iOS transparent.png`
  const {width, height} = await sharp(out(layer)).metadata()
  await write(layer, {w: width, h: height, scale: 0.56, color: '#FFFFFF'})
  const jsonFile = out(`assets/app-icons/${bundle}/icon.json`)
  const json = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
  json.fill = {'automatic-gradient': 'srgb:0.48235,0.24706,0.94902,1.00000'}
  fs.writeFileSync(jsonFile, JSON.stringify(json, null, 2) + '\n')
}

// Android adaptive icon layers (mark stays inside the 66% safe zone)
await write('assets/icon-android-foreground.png', {w: 1024, h: 1024, scale: 0.4, color: '#FFFFFF'})
await write('assets/icon-android-monochrome.png', {w: 1024, h: 1024, scale: 0.4, color: '#FFFFFF'})
await write('assets/icon-android-notification.png', {w: 96, h: 96, scale: 0.8, color: '#FFFFFF'})

// Splash screens
await write('assets/splash/splash.png', {w: 1170, h: 2529, scale: 0.26, color: '#FFFFFF', background: PRIMARY_500})
await write('assets/splash/splash-dark.png', {w: 1170, h: 2529, scale: 0.26, color: '#FFFFFF', background: PRIMARY_900})
await write('assets/splash/android-splash-logo-white.png', {w: 306, h: 271, scale: 1, color: '#FFFFFF'})

console.log('Done.')
