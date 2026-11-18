// Regenerates the Krao-branded announcement/NUX images in assets/images with
// the same file names, formats and pixel sizes as the Bluesky originals.
// Usage: node scripts/krao-announcement-images.mjs
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import sharp from 'sharp'

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'assets',
  'images',
)

const TRIANGLES = [
  'M 100 38.9 L 152.91 130.55 L 47.09 130.55 Z',
  'M 139.27 53.19 L 120.9 157.42 L 39.83 89.39 Z',
  'M 160.17 89.39 L 79.1 157.42 L 60.73 53.19 Z',
]
const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif"

/** Krao star centered at (cx, cy); `size` is the rendered star box (px). */
function star(cx, cy, size, stroke, dot = '#FFC233') {
  const s = size / 144
  return `<g transform="translate(${cx} ${cy}) scale(${s}) translate(-100 -99)">
    <circle cx="100" cy="100" r="19" fill="${dot}"/>
    <g fill="none" stroke="${stroke}" stroke-width="10.4" stroke-linejoin="miter">
      ${TRIANGLES.map(d => `<path d="${d}"/>`).join('')}
    </g></g>`
}

function gradientCard({w, h, radius, headline, id}) {
  const starSize = Math.min(w, h) * (headline ? 0.42 : 0.5)
  const cy = headline ? h * 0.42 : h / 2
  const fontSize = Math.round(h * 0.075)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0E8C6E"/>
        <stop offset="1" stop-color="#075444"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" rx="${radius}" fill="url(#g${id})"/>
    ${star(w / 2, cy, starSize, '#FFFFFF')}
    ${
      headline
        ? `<text x="${w / 2}" y="${h * 0.84}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${fontSize}" fill="#FFFFFF">${headline}</text>`
        : ''
    }
  </svg>`
}

// Diagram: Krao -> Trusted Verifier -> Verified Account (706x320, light card).
function verificationDiagram() {
  const w = 706
  const h = 320
  const label = (x, t) =>
    `<text x="${x}" y="249" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="19" fill="#4A5D57">${t}</text>`
  const arrow = x =>
    `<path d="M ${x} 136 H ${x + 36} M ${x + 26} 126 L ${x + 36} 136 L ${x + 26} 146" fill="none" stroke="#8A9A95" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
  const check = (cx, cy) =>
    `<path d="M ${cx - 27} ${cy + 2} L ${cx - 9} ${cy + 20} L ${cx + 27} ${cy - 18}" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`
  // 12-lobe badge for the verifier
  const badge = (() => {
    const cx = 352
    const cy = 136
    let d = ''
    const n = 12
    for (let i = 0; i < n * 24; i++) {
      const a = (i / (n * 24)) * Math.PI * 2
      const r = 62 + 5 * Math.cos(a * n)
      d += `${i ? 'L' : 'M'} ${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)} `
    }
    return `<path d="${d}Z" fill="#17A886"/>`
  })()
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#17A886"/><stop offset="1" stop-color="#0E8C6E"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" rx="22" fill="#EFF3F2"/>
    <circle cx="134" cy="136" r="64" fill="url(#gv)"/>
    ${star(134, 136, 80, '#FFFFFF')}
    ${arrow(222)}
    ${badge}
    ${check(352, 136)}
    ${arrow(437)}
    <circle cx="558" cy="136" r="64" fill="url(#gv)"/>
    ${check(558, 136)}
    ${label(134, 'Krao')}
    ${label(352, 'Trusted Verifier')}
    ${label(558, 'Verified Account')}
  </svg>`
}

const jobs = [
  ['groupchats_announcement_light.webp', 1435, 962, 'Group chats', 'webp'],
  ['groupchats_announcement_dark.webp', 1435, 962, 'Group chats', 'webp'],
  ['groupchats_announcement_dim.webp', 1435, 962, 'Group chats', 'webp'],
  ['invite_friends_announcement_nux.webp', 754, 440, 'Invite friends', 'webp'],
  ['chat-invite-friends.webp', 706, 418, 'Invite friends', 'webp'],
]

const variants = {
  light: ['#0E8C6E', '#075444'],
  dark: ['#0B7A60', '#04382D'],
  dim: ['#0A6F57', '#06443A'],
}

for (const [file, w, h, headline, fmt] of jobs) {
  let svg = gradientCard({w, h, radius: 24, headline, id: file.length})
  const v = Object.keys(variants).find(k => file.includes(`_${k}.`))
  if (v) svg = svg.replace('#0E8C6E', variants[v][0]).replace('#075444', variants[v][1])
  const img = sharp(Buffer.from(svg))
  await (fmt === 'webp' ? img.webp({quality: 90}) : img.png()).toFile(
    path.join(OUT, file),
  )
  const m = await sharp(path.join(OUT, file)).metadata()
  console.log(file, m.width, m.height, m.format)
}

const vf = 'initial_verification_announcement_1.png'
await sharp(Buffer.from(verificationDiagram())).png().toFile(path.join(OUT, vf))
const vm = await sharp(path.join(OUT, vf)).metadata()
console.log(vf, vm.width, vm.height, vm.format)
