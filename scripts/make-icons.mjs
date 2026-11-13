// Draws every icon the app is installed or shown with from the company's mark (shared/src/logo.ts, ADR 0170):
//
// - web/public/icon.svg: the browser tab's icon, a brand red tile with rounded corners.
// - web/public/apple-touch-icon.png (180), icon-192.png and icon-512.png: "Add to Home Screen" on an iPhone and the
//   manifest's icons (audit finding 26). Square, edge to edge: iPhones round the corners themselves and Android crops
//   to its own shape, so the manifest lists them as maskable too.
// - The native shells' icons (ADR 0112): the iPhone app's 1024 pixel icon, with no see-through pixels as Apple asks,
//   and Android's launcher icons (square, round, and the adaptive icon's foreground over a brand red background).
//
// Every one is the mark in white on the brand red, the same red the phone's status bar takes, with the circle filling
// about seven tenths of the square: inside the middle 80% Android keeps whatever shape it cuts the icon to, while the
// lines through the circle run off its edges, as they run out of the circle on the logo.
//
// Run: node scripts/make-icons.mjs (the browser tests' Chromium draws them, so it needs no new package; PW_CHROMIUM
// points it at another Chromium, as for the tests).
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { LOGO_CIRCLE, LOGO_SHAPES } from '../shared/src/logo.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const RED = '#ee3744'
const WHITE = '#ffffff'
/** The circle's share of the square's side. */
const CIRCLE = 0.72

/**
 * The mark cut square round its circle, as SVG. `share` is the circle's part of the side; `tile` the background,
 * none for see-through; `round` the corner radius as a part of the side.
 */
function square({ share = CIRCLE, tile = RED, round = 0, shape = 'square' } = {}) {
  const side = LOGO_CIRCLE.d / share
  const x = LOGO_CIRCLE.cx - side / 2
  const y = LOGO_CIRCLE.cy - side / 2
  const r = round * side
  const box = `x="${x}" y="${y}" width="${side}" height="${side}"`
  const back = !tile ? '' : shape === 'round' ? `<circle cx="${LOGO_CIRCLE.cx}" cy="${LOGO_CIRCLE.cy}" r="${side / 2}" fill="${tile}"/>` : `<rect ${box} rx="${r}" fill="${tile}"/>`
  // Clipped to the tile's own shape, so the lines stop at its edge rather than at the square's corners.
  const clip = shape === 'round' ? `<circle cx="${LOGO_CIRCLE.cx}" cy="${LOGO_CIRCLE.cy}" r="${side / 2}"/>` : `<rect ${box} rx="${r}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${side} ${side}"><defs><clipPath id="t">${clip}</clipPath></defs>${back}<g clip-path="url(#t)" color="${WHITE}">${LOGO_SHAPES}</g></svg>`
}

// The tab's icon: rounded as the old one was, since a browser draws it as it is.
writeFileSync(join(root, 'web/public/icon.svg'), square({ round: 12 / 64 }) + '\n')
console.log('icon.svg')

const android = 'app/android/app/src/main/res'
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const PNGS = [
  ['web/public/apple-touch-icon.png', 180, square()],
  ['web/public/icon-192.png', 192, square()],
  ['web/public/icon-512.png', 512, square()],
  ['app/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, square()],
  ...Object.entries(DENSITIES).flatMap(([name, k]) => [
    // Older Androids show these as they are: a rounded square and a circle.
    [`${android}/mipmap-${name}/ic_launcher.png`, 48 * k, square({ round: 0.12 })],
    [`${android}/mipmap-${name}/ic_launcher_round.png`, 48 * k, square({ shape: 'round' })],
    // The adaptive icon's top layer is 108 units with the middle 72 shown, so the circle is drawn two thirds as big.
    [`${android}/mipmap-${name}/ic_launcher_foreground.png`, 108 * k, square({ share: (CIRCLE * 72) / 108, tile: null })],
  ]),
]

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const page = await browser.newPage()
for (const [path, size, svg] of PNGS) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent"><img src="data:image/svg+xml,${encodeURIComponent(svg)}" style="display:block;width:${size}px;height:${size}px"></body></html>`,
  )
  // See-through where the shape leaves the corners clear; the square tiles fill every pixel.
  await page.screenshot({ path: join(root, path), type: 'png', omitBackground: true })
  console.log(`${path}: ${size}×${size}`)
}
await browser.close()
