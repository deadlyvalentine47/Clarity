import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { HomeSection, ThemeMode } from '../db/types'
import { HOME_SECTIONS } from '../db/types'
import {
  isFirstLaunch,
  loadPreferences,
  savePreferences,
  type Preferences,
} from '../lib/prefs'
import { applyTheme } from '../lib/themes'
import { isNative } from '../lib/native'
import { scheduleNightlyBackup, writeBackupSnapshot } from '../lib/backupScheduler'

interface PreferencesContextValue {
  prefs: Preferences
  firstLaunch: boolean
  setUsername: (name: string) => void
  completeOnboarding: () => void
  setTheme: (name: string) => void
  setDarkMode: (mode: ThemeMode) => void
  setSectionOrder: (order: HomeSection[]) => void
  setSectionEnabled: (enabled: HomeSection[]) => void
  toggleSection: (section: HomeSection) => void
  moveSection: (section: HomeSection, direction: -1 | 1) => void
  importPreferences: (prefs: Partial<Preferences>) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(() => loadPreferences())
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  useEffect(() => {
    savePreferences(prefs)
  }, [prefs])

  // Android: keep a fresh backup snapshot in the app cache and make sure the
  // nightly 23:30 job is registered. The worker copies the snapshot to the
  // device; the WebView does not need to be running then.
  useEffect(() => {
    if (!isNative()) return
    void scheduleNightlyBackup()
    void writeBackupSnapshot(prefsRef.current)
    const timer = window.setInterval(
      () => void writeBackupSnapshot(prefsRef.current),
      15 * 60_000,
    )
    const onHide = () => {
      if (document.visibilityState === 'hidden') void writeBackupSnapshot(prefsRef.current)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  useEffect(() => {
    if (!isNative()) return
    const timer = window.setTimeout(() => void writeBackupSnapshot(prefsRef.current), 1500)
    return () => window.clearTimeout(timer)
  }, [prefs])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => applyTheme(prefs.theme, prefs.darkMode, media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [prefs.theme, prefs.darkMode])

  const value = useMemo<PreferencesContextValue>(
    () => ({
      prefs,
      firstLaunch: isFirstLaunch(prefs),
      setUsername: (name) => setPrefs((p) => ({ ...p, username: name, onboarded: true })),
      completeOnboarding: () => setPrefs((p) => ({ ...p, onboarded: true })),
      setTheme: (theme) => setPrefs((p) => ({ ...p, theme })),
      setDarkMode: (darkMode) => setPrefs((p) => ({ ...p, darkMode })),
      setSectionOrder: (sectionOrder) => setPrefs((p) => ({ ...p, sectionOrder })),
      setSectionEnabled: (sectionEnabled) => setPrefs((p) => ({ ...p, sectionEnabled })),
      toggleSection: (section) =>
        setPrefs((p) => ({
          ...p,
          sectionEnabled: p.sectionEnabled.includes(section)
            ? p.sectionEnabled.filter((s) => s !== section)
            : [...p.sectionEnabled, section],
        })),
      moveSection: (section, direction) =>
        setPrefs((p) => {
          const order = [...p.sectionOrder]
          const index = order.indexOf(section)
          const next = index + direction
          if (index < 0 || next < 0 || next >= order.length) return p
          order.splice(index, 1)
          order.splice(next, 0, section)
          return { ...p, sectionOrder: order }
        }),
      importPreferences: (next) =>
        setPrefs((p) => {
          const isSection = (s: string): s is HomeSection =>
            (HOME_SECTIONS as readonly string[]).includes(s)
          const order = (next.sectionOrder ?? p.sectionOrder).filter(isSection)
          const enabled = (next.sectionEnabled ?? p.sectionEnabled).filter(isSection)
          // A backup never carries the onboarding flag, and importing one means
          // the user is set up — never send them back to the welcome screen.
          return { ...p, ...next, onboarded: true, sectionOrder: order, sectionEnabled: enabled }
        }),
    }),
    [prefs],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
