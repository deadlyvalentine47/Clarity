// Theme palettes ported from ui/theme/Color.kt (six selectable themes).
import type { ThemeMode } from '../db/types'

export interface Palette {
  name: string
  primary: string
  onPrimary: string
  primaryContainer: string
  onPrimaryContainer: string
  secondary: string
  secondaryContainer: string
  onSecondaryContainer: string
  backgroundLight: string
  surfaceLight: string
  textLight: string
  backgroundDark: string
  surfaceDark: string
  textDark: string
  error: string
  success: string
  warning: string
}

export const THEMES: Record<string, Palette> = {
  Ocean: {
    name: 'Ocean',
    primary: '#3B82A0',
    onPrimary: '#FFFFFF',
    primaryContainer: '#C7E8F0',
    onPrimaryContainer: '#1A3B48',
    secondary: '#5B8C9E',
    secondaryContainer: '#D3E6ED',
    onSecondaryContainer: '#2C4F5E',
    backgroundLight: '#F4F4F0',
    surfaceLight: '#FCFCF9',
    textLight: '#2C2C2A',
    backgroundDark: '#1C1C1A',
    surfaceDark: '#2A2A27',
    textDark: '#E5E5E0',
    error: '#D9524D',
    success: '#3F8F5B',
    warning: '#C98A1E',
  },
  Forest: {
    name: 'Forest',
    primary: '#5A8F6C',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D4E8D4',
    onPrimaryContainer: '#2A4A34',
    secondary: '#8FAA7B',
    secondaryContainer: '#E0ECD6',
    onSecondaryContainer: '#415233',
    backgroundLight: '#F6F4EE',
    surfaceLight: '#FDFCF7',
    textLight: '#2D2D28',
    backgroundDark: '#1D1E1A',
    surfaceDark: '#2B2C26',
    textDark: '#E6E5DD',
    error: '#C94F4F',
    success: '#4E8F5E',
    warning: '#C08A28',
  },
  Dusk: {
    name: 'Dusk',
    primary: '#8B6FA8',
    onPrimary: '#FFFFFF',
    primaryContainer: '#E5D6F0',
    onPrimaryContainer: '#463557',
    secondary: '#B089A3',
    secondaryContainer: '#EDDCE6',
    onSecondaryContainer: '#5E4252',
    backgroundLight: '#F3F2F4',
    surfaceLight: '#FCFBFC',
    textLight: '#2C2B2D',
    backgroundDark: '#1C1B1D',
    surfaceDark: '#2A292C',
    textDark: '#E5E3E6',
    error: '#CF5C5C',
    success: '#4F8A62',
    warning: '#BE8B2C',
  },
  Sunset: {
    name: 'Sunset',
    primary: '#D4805A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#F5E0D4',
    onPrimaryContainer: '#6E3D27',
    secondary: '#E8A77E',
    secondaryContainer: '#F7E6DA',
    onSecondaryContainer: '#7A4930',
    backgroundLight: '#FDF6F0',
    surfaceLight: '#FFFBF7',
    textLight: '#2E2B28',
    backgroundDark: '#1F1C19',
    surfaceDark: '#2E2A26',
    textDark: '#E8E4DE',
    error: '#D9524D',
    success: '#4E8A5C',
    warning: '#C4861F',
  },
  Slate: {
    name: 'Slate',
    primary: '#6B7F8F',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D6E0E8',
    onPrimaryContainer: '#33424E',
    secondary: '#8F9BA6',
    secondaryContainer: '#E0E6EC',
    onSecondaryContainer: '#47535E',
    backgroundLight: '#F2F4F6',
    surfaceLight: '#FBFCFD',
    textLight: '#2A2D30',
    backgroundDark: '#1A1C1E',
    surfaceDark: '#282A2D',
    textDark: '#E3E5E8',
    error: '#D9524D',
    success: '#42855A',
    warning: '#B98525',
  },
  Rose: {
    name: 'Rose',
    primary: '#C47A9E',
    onPrimary: '#FFFFFF',
    primaryContainer: '#F3DAE6',
    onPrimaryContainer: '#653A54',
    secondary: '#D4A0B5',
    secondaryContainer: '#F5E4EC',
    onSecondaryContainer: '#70465C',
    backgroundLight: '#FDF5F7',
    surfaceLight: '#FFFAFB',
    textLight: '#2E2B2C',
    backgroundDark: '#1F1B1D',
    surfaceDark: '#2E292C',
    textDark: '#E7E2E4',
    error: '#D9524D',
    success: '#4E8A62',
    warning: '#C08427',
  },
}

export const THEME_NAMES = Object.keys(THEMES)
export const DEFAULT_THEME = 'Ocean'

export function isDarkNow(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return systemPrefersDark
}

function mix(hex: string, other: string, weight: number): string {
  const parse = (h: string) => {
    const v = h.replace('#', '')
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = parse(hex)
  const [r2, g2, b2] = parse(other)
  const r = Math.round(r1 * (1 - weight) + r2 * weight)
  const g = Math.round(g1 * (1 - weight) + g2 * weight)
  const b = Math.round(b1 * (1 - weight) + b2 * weight)
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

/** Apply a palette + mode to the document CSS variables. */
export function applyTheme(themeName: string, mode: ThemeMode, systemPrefersDark: boolean): void {
  const palette = THEMES[themeName] ?? THEMES[DEFAULT_THEME]
  const dark = isDarkNow(mode, systemPrefersDark)
  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'

  const surface = dark ? palette.surfaceDark : palette.surfaceLight
  const background = dark ? palette.backgroundDark : palette.backgroundLight
  const text = dark ? palette.textDark : palette.textLight
  // Light themes need a darker muted tone to clear WCAG AA on surfaces.
  const muted = mix(text, background, dark ? 0.38 : 0.3)
  const outline = mix(text, surface, dark ? 0.78 : 0.84)
  // Darken status colours on light surfaces (text on pale containers) and give
  // primary buttons a stronger fill so white text keeps its contrast.
  const statusText = (hex: string, weight: number) => (dark ? hex : mix(hex, '#000000', weight))
  const primaryStrong = dark ? palette.primary : mix(palette.primary, '#000000', 0.2)

  const vars: Record<string, string> = {
    '--primary': palette.primary,
    '--primary-strong': primaryStrong,
    '--primary-variant': dark ? mix(palette.primary, '#000000', 0.15) : mix(palette.primary, '#000000', 0.12),
    '--primary-container': dark ? mix(palette.primary, background, 0.72) : palette.primaryContainer,
    '--on-primary': palette.onPrimary,
    '--on-primary-container': dark ? mix(text, palette.primary, 0.15) : palette.onPrimaryContainer,
    '--secondary': dark ? mix(palette.secondary, '#FFFFFF', 0.15) : palette.secondary,
    '--secondary-container': dark ? mix(palette.secondary, background, 0.7) : palette.secondaryContainer,
    '--on-secondary-container': dark ? text : palette.onSecondaryContainer,
    '--bg': background,
    '--surface': surface,
    '--surface-2': dark ? mix(surface, '#FFFFFF', 0.06) : mix(surface, '#000000', 0.04),
    '--surface-3': dark ? mix(surface, '#FFFFFF', 0.11) : mix(surface, '#000000', 0.08),
    '--text': text,
    '--muted': muted,
    '--outline': outline,
    '--error': statusText(palette.error, 0.12),
    '--error-container': dark ? mix(palette.error, background, 0.78) : mix(palette.error, '#FFFFFF', 0.86),
    '--success': statusText(palette.success, 0.16),
    '--success-container': dark ? mix(palette.success, background, 0.78) : mix(palette.success, '#FFFFFF', 0.86),
    '--warning': statusText(palette.warning, 0.24),
    '--warning-container': dark ? mix(palette.warning, background, 0.78) : mix(palette.warning, '#FFFFFF', 0.85),
    '--shadow': dark
      ? '0 1px 2px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.35)'
      : '0 1px 2px rgba(16,24,40,0.06), 0 4px 12px rgba(16,24,40,0.06)',
    '--shadow-lg': dark
      ? '0 8px 32px rgba(0,0,0,0.6)'
      : '0 8px 32px rgba(16,24,40,0.16)',
  }

  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)
  root.style.colorScheme = dark ? 'dark' : 'light'

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', palette.primary)
}
