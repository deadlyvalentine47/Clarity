// Wallpaper support: store the picture, pull a palette out of it, and paint the
// whole app with colours that belong to the photo. Everything here is pure DOM
// + IndexedDB; no network and no native plugin.
import { db } from '../db/db'
import type { WallpaperOptions } from './prefs'

export const WALLPAPER_ID = 'current'
const MAX_SIDE = 2560
const THUMB_SIDE = 48
// SVG is excluded: it can carry script when rendered outside an <img>.
const SAFE_IMAGE_TYPE = /^image\/(png|jpeg|jpg|webp|gif|bmp|avif)$/
const MAX_SOURCE_BYTES = 25 * 1024 * 1024

export interface WallpaperSeed {
  hue: number
  saturation: number
  lightness: number
  /** perceived brightness of the photo, 0..1 */
  luminance: number
  accents: Array<{ hue: number; saturation: number; lightness: number }>
}

export interface WallpaperPalette {
  primary: string
  primaryStrong: string
  primaryVariant: string
  primaryContainer: string
  onPrimary: string
  onPrimaryContainer: string
  secondary: string
  secondaryContainer: string
  onSecondaryContainer: string
  bg: string
  surface: string
  surface2: string
  surface3: string
  text: string
  muted: string
  outline: string
  error: string
  errorContainer: string
  success: string
  successContainer: string
  warning: string
  warningContainer: string
}

type RGB = [number, number, number]

/* ------------------------------ colour maths ------------------------------ */

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function hexToRgb(hex: string): RGB {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b]
    .map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`
}

function hueToRgb(p: number, q: number, t: number): number {
  let value = t
  if (value < 0) value += 1
  if (value > 1) value -= 1
  if (value < 1 / 6) return p + (q - p) * 6 * value
  if (value < 1 / 2) return q
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
  return p
}

function hslToRgb(hue: number, saturation: number, lightness: number): RGB {
  const h = (((hue % 360) + 360) % 360) / 360
  if (saturation === 0) {
    const v = Math.round(lightness * 255)
    return [v, v, v]
  }
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ]
}

function hsl(hue: number, saturation: number, lightness: number): string {
  return rgbToHex(hslToRgb(hue, clamp(saturation, 0, 1), clamp(lightness, 0, 1)))
}

function rgbToHsl([r, g, b]: RGB): RGB {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  if (max === min) return [0, 0, lightness]
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue: number
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0)
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  return [hue * 60, saturation, lightness]
}

function channelLuminance(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

function contrast(a: RGB, b: RGB): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function contrastHex(a: string, b: string): number {
  return contrast(hexToRgb(a), hexToRgb(b))
}

/** Move a colour's lightness until it clears the requested contrast ratio. */
function ensureContrast(colour: string, against: string, ratio: number): string {
  if (contrastHex(colour, against) >= ratio) return colour
  const [hue, saturation, lightness] = rgbToHsl(hexToRgb(colour))
  const darken = luminance(hexToRgb(against)) > 0.45
  for (let step = 1; step <= 30; step += 1) {
    const next = clamp(lightness + (darken ? -step : step) * 0.03, 0, 1)
    const candidate = rgbToHex(hslToRgb(hue, saturation, next))
    if (contrastHex(candidate, against) >= ratio) return candidate
  }
  return darken ? '#000000' : '#ffffff'
}

function mixHex(a: string, b: string, weight: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex([
    r1 * (1 - weight) + r2 * weight,
    g1 * (1 - weight) + g2 * weight,
    b1 * (1 - weight) + b2 * weight,
  ])
}

/* ---------------------------- image utilities ----------------------------- */

async function decodeImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' })
    } catch {
      // fall through to the element decoder
    }
  }
  return await new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(blob)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That image could not be read'))
    }
    image.src = url
  })
}

function releaseImage(source: ImageBitmap | HTMLImageElement) {
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close()
}

/** Validate, downscale and re-encode the picked file before storing it. */
export async function prepareWallpaper(file: File): Promise<Blob> {
  if (!SAFE_IMAGE_TYPE.test(file.type)) {
    throw new Error('Pick a PNG, JPEG, WebP, GIF, BMP or AVIF image')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('That image is over 25 MB — pick a smaller one')
  }
  const source = await decodeImage(file)
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height))
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available')
    context.drawImage(source as CanvasImageSource, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Could not process that image'))),
        'image/jpeg',
        0.86,
      )
    })
  } finally {
    releaseImage(source)
  }
}

export async function extractWallpaperSeed(blob: Blob): Promise<WallpaperSeed> {
  const source = await decodeImage(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = THUMB_SIDE
    canvas.height = THUMB_SIDE
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas is not available')
    context.drawImage(source as CanvasImageSource, 0, 0, THUMB_SIDE, THUMB_SIDE)
    return seedFromPixels(context.getImageData(0, 0, THUMB_SIDE, THUMB_SIDE).data)
  } finally {
    releaseImage(source)
  }
}

interface Bucket {
  count: number
  x: number
  y: number
  saturation: number
  lightness: number
  red: number
  green: number
  blue: number
}

function seedFromPixels(data: Uint8ClampedArray): WallpaperSeed {
  const buckets = new Map<string, Bucket>()
  let lumaSum = 0
  let lumaCount = 0

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    if (alpha < 32) continue
    const [r, g, b] = [data[index], data[index + 1], data[index + 2]]
    lumaSum += luminance([r, g, b])
    lumaCount += 1
    const [hue, saturation, lightness] = rgbToHsl([r, g, b])
    // Nearly black/white pixels carry no usable hue.
    if (lightness < 0.04 || lightness > 0.96) continue
    const key = `${Math.floor(hue / 15)}:${Math.floor(saturation * 4)}:${Math.floor(lightness * 4)}`
    const bucket: Bucket =
      buckets.get(key) ?? { count: 0, x: 0, y: 0, saturation: 0, lightness: 0, red: 0, green: 0, blue: 0 }
    const radians = (hue * Math.PI) / 180
    bucket.x += Math.cos(radians)
    bucket.y += Math.sin(radians)
    bucket.saturation += saturation
    bucket.lightness += lightness
    bucket.red += r
    bucket.green += g
    bucket.blue += b
    bucket.count += 1
    buckets.set(key, bucket)
  }

  const averageLuminance = lumaCount > 0 ? lumaSum / lumaCount : 0.5
  const scored = [...buckets.values()]
    .map((bucket) => {
      const saturation = bucket.saturation / bucket.count
      const lightness = bucket.lightness / bucket.count
      // Favour vivid, mid-light areas; a giant white wall should not win.
      const score = bucket.count * (0.15 + saturation) * (1 - Math.abs(lightness - 0.5) * 0.7)
      return {
        bucket,
        hue: ((Math.atan2(bucket.y, bucket.x) * 180) / Math.PI + 360) % 360,
        saturation,
        lightness,
        score,
      }
    })
    .sort((a, b) => b.score - a.score)

  const colourful = scored.filter(
    (entry) => entry.saturation >= 0.16 && entry.lightness >= 0.1 && entry.lightness <= 0.9,
  )
  // A greyscale photo has no hue worth keeping: rgbToHsl reports 0 there, which
  // would paint the whole app red. Fall back to a cool neutral instead.
  const achromatic = colourful.length === 0
  const best = colourful[0] ?? scored[0]
  const hue = best && !achromatic ? best.hue : 215
  const saturation = best && !achromatic ? best.saturation : 0.06
  const lightness = best ? best.lightness : 0.5

  const accents: WallpaperSeed['accents'] = []
  for (const entry of scored) {
    if (entry.saturation < 0.12) continue
    if (accents.some((accent) => Math.abs(((accent.hue - entry.hue + 540) % 360) - 180) < 25)) continue
    accents.push({ hue: entry.hue, saturation: entry.saturation, lightness: entry.lightness })
    if (accents.length === 3) break
  }

  return { hue, saturation, lightness, luminance: averageLuminance, accents }
}

/* ------------------------------- palette ---------------------------------- */

export function buildWallpaperPalette(seed: WallpaperSeed, dark: boolean): WallpaperPalette {
  const hue = seed.hue
  const neutral = dark ? 0.16 : 0.13

  const bg = hsl(hue, neutral * 0.55, dark ? 0.07 : 0.94)
  const surface = hsl(hue, neutral * 0.45, dark ? 0.13 : 0.98)
  const surface2 = hsl(hue, neutral * 0.5, dark ? 0.18 : 0.95)
  const surface3 = hsl(hue, neutral * 0.55, dark ? 0.23 : 0.9)
  const outline = hsl(hue, neutral * 0.6, dark ? 0.31 : 0.8)

  // Body copy is the strictest requirement; muted text only needs AA.
  let text = hsl(hue, 0.1, dark ? 0.93 : 0.14)
  text = ensureContrast(text, surface, 7)
  text = ensureContrast(text, bg, 7)
  let muted = hsl(hue, 0.1, dark ? 0.7 : 0.43)
  muted = ensureContrast(muted, surface, 4.5)
  muted = ensureContrast(muted, bg, 4.5)

  const primarySaturation = clamp(seed.saturation, 0.42, 0.8)
  const primaryLightness = dark
    ? clamp(seed.lightness, 0.58, 0.72)
    : clamp(seed.lightness, 0.32, 0.44)
  const basePrimary = hsl(hue, primarySaturation, primaryLightness)
  const white: RGB = [255, 255, 255]
  const black: RGB = [18, 18, 22]
  const onPrimary =
    contrast(hexToRgb(basePrimary), white) >= contrast(hexToRgb(basePrimary), black)
      ? '#ffffff'
      : '#121216'
  const primary = ensureContrast(basePrimary, onPrimary, 4.5)
  const primaryStrong = ensureContrast(
    dark ? primary : mixHex(primary, '#000000', 0.08),
    onPrimary,
    4.5,
  )
  const primaryVariant = dark ? mixHex(primary, '#000000', 0.18) : mixHex(primary, '#000000', 0.14)
  const primaryContainer = hsl(
    hue,
    dark ? primarySaturation * 0.45 : clamp(seed.saturation, 0.3, 0.7),
    dark ? 0.24 : 0.9,
  )
  let onPrimaryContainer = hsl(hue, dark ? 0.2 : 0.45, dark ? 0.9 : 0.22)
  onPrimaryContainer = ensureContrast(onPrimaryContainer, primaryContainer, 4.5)

  const accent = seed.accents[0] ?? { hue: hue + 32, saturation: seed.saturation, lightness: seed.lightness }
  const secondaryHue = accent.hue
  const secondarySaturation = clamp(accent.saturation || seed.saturation, 0.35, 0.7)
  const secondary = hsl(secondaryHue, secondarySaturation, dark ? 0.68 : 0.4)
  const secondaryContainer = hsl(secondaryHue, dark ? 0.28 : 0.5, dark ? 0.24 : 0.91)
  let onSecondaryContainer = hsl(secondaryHue, 0.25, dark ? 0.9 : 0.22)
  onSecondaryContainer = ensureContrast(onSecondaryContainer, secondaryContainer, 4.5)

  const error = ensureContrast(hsl(6, 0.72, dark ? 0.7 : 0.4), bg, 4.5)
  const success = ensureContrast(hsl(145, 0.55, dark ? 0.62 : 0.34), bg, 4.5)
  const warning = ensureContrast(hsl(38, 0.78, dark ? 0.68 : 0.36), bg, 4.5)
  const errorContainer = ensureContrast(hsl(6, dark ? 0.4 : 0.72, dark ? 0.22 : 0.94), error, 4.5)
  const successContainer = ensureContrast(hsl(145, dark ? 0.32 : 0.55, dark ? 0.2 : 0.93), success, 4.5)
  const warningContainer = ensureContrast(hsl(38, dark ? 0.36 : 0.7, dark ? 0.22 : 0.93), warning, 4.5)

  return {
    primary,
    primaryStrong,
    primaryVariant,
    primaryContainer,
    onPrimary,
    onPrimaryContainer,
    secondary,
    secondaryContainer,
    onSecondaryContainer,
    bg,
    surface,
    surface2,
    surface3,
    text,
    muted,
    outline,
    error,
    errorContainer,
    success,
    successContainer,
    warning,
    warningContainer,
  }
}

function paletteVars(palette: WallpaperPalette): Record<string, string> {
  return {
    '--primary': palette.primary,
    '--primary-strong': palette.primaryStrong,
    '--primary-variant': palette.primaryVariant,
    '--primary-container': palette.primaryContainer,
    '--on-primary': palette.onPrimary,
    '--on-primary-container': palette.onPrimaryContainer,
    '--secondary': palette.secondary,
    '--secondary-container': palette.secondaryContainer,
    '--on-secondary-container': palette.onSecondaryContainer,
    '--bg': palette.bg,
    '--surface': palette.surface,
    '--surface-2': palette.surface2,
    '--surface-3': palette.surface3,
    '--text': palette.text,
    '--muted': palette.muted,
    '--outline': palette.outline,
    '--error': palette.error,
    '--error-container': palette.errorContainer,
    '--success': palette.success,
    '--success-container': palette.successContainer,
    '--warning': palette.warning,
    '--warning-container': palette.warningContainer,
  }
}

const WALLPAPER_VARS = [
  '--wallpaper-image',
  '--wallpaper-scrim',
  '--surface-rgb',
  '--surface-2-rgb',
  '--surface-3-rgb',
] as const

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
}

function rgbTriplet(hex: string): string {
  return hexToRgb(hex).join(', ')
}

/**
 * Apply the wallpaper and (optionally) its derived palette. Must run after
 * applyTheme(), which writes the base theme variables.
 */
export function applyWallpaper(
  url: string | null,
  seed: WallpaperSeed | null,
  options: WallpaperOptions,
  dark: boolean,
): void {
  const root = document.documentElement
  const active = Boolean(url) && options.enabled
  root.dataset.wallpaper = active ? 'on' : 'off'

  if (!active) {
    for (const name of WALLPAPER_VARS) root.style.removeProperty(name)
    return
  }

  if (options.tint && seed) {
    const palette = buildWallpaperPalette(seed, dark)
    for (const [name, value] of Object.entries(paletteVars(palette))) {
      root.style.setProperty(name, value)
    }
  }

  const read = (name: string, fallback: string) =>
    root.style.getPropertyValue(name).trim() || fallback

  // Cards and forms become frosted glass so the photo shows through, but the
  // alpha stays high enough that the contrast checks above still hold.
  const surface = read('--surface', dark ? '#202020' : '#ffffff')
  const surface2 = read('--surface-2', surface)
  const surface3 = read('--surface-3', surface)
  const bg = read('--bg', dark ? '#121212' : '#f5f5f5')

  const surfaceAlpha = 0.62 + options.dim * 0.28
  root.style.setProperty('--surface', rgba(surface, surfaceAlpha))
  root.style.setProperty('--surface-2', rgba(surface2, Math.max(0.42, surfaceAlpha - 0.14)))
  root.style.setProperty('--surface-3', rgba(surface3, Math.max(0.32, surfaceAlpha - 0.22)))
  root.style.setProperty('--surface-rgb', rgbTriplet(surface))
  root.style.setProperty('--surface-2-rgb', rgbTriplet(surface2))
  root.style.setProperty('--surface-3-rgb', rgbTriplet(surface3))

  // A bright photo behind dark text (or the reverse) needs a heavier scrim.
  let dim = options.dim
  if (seed) {
    if (dark && seed.luminance > 0.55) dim += 0.1
    if (!dark && seed.luminance < 0.3) dim += 0.1
  }
  dim = clamp(dim, 0.2, 0.9)

  const [bgR, bgG, bgB] = hexToRgb(bg)
  root.style.setProperty(
    '--wallpaper-scrim',
    `linear-gradient(180deg, rgba(${bgR}, ${bgG}, ${bgB}, ${dim.toFixed(3)}), rgba(${bgR}, ${bgG}, ${bgB}, ${clamp(dim * 0.82, 0, 1).toFixed(3)}))`,
  )
  root.style.setProperty('--wallpaper-image', `url("${url}")`)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', read('--bg', dark ? '#121212' : '#f5f5f5'))
}

/* ------------------------------- storage ---------------------------------- */

export async function loadWallpaperBlob(): Promise<Blob | null> {
  const row = await db.wallpaper.get(WALLPAPER_ID)
  return row?.blob ?? null
}

export async function saveWallpaperBlob(blob: Blob, name: string): Promise<void> {
  await db.wallpaper.put({ id: WALLPAPER_ID, blob, name, createdAt: Date.now() })
}

export async function deleteWallpaperBlob(): Promise<void> {
  await db.wallpaper.delete(WALLPAPER_ID)
}
