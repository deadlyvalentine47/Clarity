// Port of data/local/datastore/UserPreferences.kt (backed by localStorage).
import { HOME_SECTIONS, type DistanceUnit, type HomeSection, type ThemeMode } from '../db/types'
import { DEFAULT_THEME, THEME_NAMES } from './themes'

export interface Preferences {
  username: string
  /** Onboarding finished. Kept separate from the name so importing a backup
   *  without a username doesn't drop the user back into onboarding. */
  onboarded: boolean
  theme: string
  darkMode: ThemeMode
  sectionOrder: HomeSection[]
  sectionEnabled: HomeSection[]
  distanceUnit: DistanceUnit
}

const KEY = 'clarity.preferences'

export const DEFAULT_PREFERENCES: Preferences = {
  username: '',
  onboarded: false,
  theme: DEFAULT_THEME,
  darkMode: 'system',
  sectionOrder: [...HOME_SECTIONS],
  sectionEnabled: [...HOME_SECTIONS],
  distanceUnit: 'km',
}

function isSection(value: string): value is HomeSection {
  return (HOME_SECTIONS as readonly string[]).includes(value)
}

export function normalizePreferences(input: Partial<Preferences> | null | undefined): Preferences {
  const raw = input ?? {}
  const theme = typeof raw.theme === 'string' && THEME_NAMES.includes(raw.theme) ? raw.theme : DEFAULT_THEME
  const darkMode: ThemeMode =
    raw.darkMode === 'light' || raw.darkMode === 'dark' || raw.darkMode === 'system'
      ? raw.darkMode
      : 'system'

  const storedOrder = Array.isArray(raw.sectionOrder) ? raw.sectionOrder.filter(isSection) : []
  const seen = new Set(storedOrder)
  // Append sections added in newer versions so they are not hidden forever.
  const sectionOrder = [...storedOrder, ...HOME_SECTIONS.filter((s) => !seen.has(s))]

  const storedEnabled = Array.isArray(raw.sectionEnabled) ? raw.sectionEnabled.filter(isSection) : null
  const sectionEnabled =
    storedEnabled == null
      ? [...HOME_SECTIONS]
      : [...new Set([...storedEnabled, ...HOME_SECTIONS.filter((s) => !storedOrder.includes(s))])]

  const username = typeof raw.username === 'string' ? raw.username : ''

  // Old localStorage entries and backups have no unit; they silently become km.
  const distanceUnit: DistanceUnit = raw.distanceUnit === 'mi' ? 'mi' : 'km'

  return {
    username,
    // Existing installs (which always had a name) migrate to "onboarded".
    onboarded: raw.onboarded === true || username !== '',
    theme,
    darkMode,
    sectionOrder,
    sectionEnabled,
    distanceUnit,
  }
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    return normalizePreferences(JSON.parse(raw) as Partial<Preferences>)
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(prefs: Preferences) {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

export function isFirstLaunch(prefs: Preferences): boolean {
  return !prefs.onboarded
}
