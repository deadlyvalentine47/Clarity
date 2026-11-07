import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DistanceUnit, HomeSection, ThemeMode } from '../db/types'
import { HOME_SECTIONS } from '../db/types'
import {
  isFirstLaunch,
  loadPreferences,
  savePreferences,
  type Preferences,
  type WallpaperOptions,
} from '../lib/prefs'
import { applyTheme, isDarkNow } from '../lib/themes'
import {
  applyWallpaper,
  buildWallpaperPalette,
  deleteWallpaperBlob,
  extractWallpaperSeed,
  loadWallpaperBlob,
  prepareWallpaper,
  saveWallpaperBlob,
  type WallpaperPalette,
  type WallpaperSeed,
} from '../lib/wallpaper'
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
  setDistanceUnit: (unit: DistanceUnit) => void
  importPreferences: (prefs: Partial<Preferences>) => void
  wallpaperUrl: string | null
  wallpaperSeed: WallpaperSeed | null
  wallpaperPalette: WallpaperPalette | null
  wallpaperBusy: boolean
  wallpaperError: string
  setWallpaperFile: (file: File) => Promise<void>
  removeWallpaper: () => Promise<void>
  reloadWallpaper: () => Promise<void>
  setWallpaperOptions: (patch: Partial<WallpaperOptions>) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(() => loadPreferences())
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null)
  const [wallpaperSeed, setWallpaperSeed] = useState<WallpaperSeed | null>(null)
  const [wallpaperBusy, setWallpaperBusy] = useState(false)
  const [wallpaperError, setWallpaperError] = useState('')
  const wallpaperUrlRef = useRef<string | null>(null)

  useEffect(() => {
    savePreferences(prefs)
  }, [prefs])

  // Native (Android/iOS): keep a fresh backup snapshot in the app cache and
  // make sure the nightly 23:30 job is registered. The worker copies the
  // snapshot to the device; the WebView does not need to be running then.
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

  // Load the stored photo once, then let the palette drive the theme.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const blob = await loadWallpaperBlob()
        if (!blob || cancelled) return
        const seed = await extractWallpaperSeed(blob)
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        wallpaperUrlRef.current = url
        setWallpaperUrl(url)
        setWallpaperSeed(seed)
      } catch {
        // A stored image that no longer decodes should not break startup.
      }
    })()
    return () => {
      cancelled = true
      if (wallpaperUrlRef.current) {
        URL.revokeObjectURL(wallpaperUrlRef.current)
        wallpaperUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      applyTheme(prefs.theme, prefs.darkMode, media.matches)
      applyWallpaper(wallpaperUrl, wallpaperSeed, prefs.wallpaper, isDarkNow(prefs.darkMode, media.matches))
    }
    const onScheme = () => {
      setSystemDark(media.matches)
      apply()
    }
    apply()
    media.addEventListener('change', onScheme)
    return () => media.removeEventListener('change', onScheme)
  }, [prefs.theme, prefs.darkMode, prefs.wallpaper, wallpaperUrl, wallpaperSeed])

  const wallpaperPalette = useMemo(
    () =>
      wallpaperSeed
        ? buildWallpaperPalette(wallpaperSeed, isDarkNow(prefs.darkMode, systemDark))
        : null,
    [wallpaperSeed, prefs.darkMode, systemDark],
  )

  const setWallpaperFile = useCallback(async (file: File) => {
    setWallpaperBusy(true)
    setWallpaperError('')
    try {
      const blob = await prepareWallpaper(file)
      const seed = await extractWallpaperSeed(blob)
      await saveWallpaperBlob(blob, file.name)
      const url = URL.createObjectURL(blob)
      if (wallpaperUrlRef.current) URL.revokeObjectURL(wallpaperUrlRef.current)
      wallpaperUrlRef.current = url
      setWallpaperUrl(url)
      setWallpaperSeed(seed)
      setPrefs((current) => ({
        ...current,
        wallpaper: { ...current.wallpaper, enabled: true, name: file.name },
      }))
    } catch (error) {
      setWallpaperError(error instanceof Error ? error.message : 'Could not set that wallpaper')
    } finally {
      setWallpaperBusy(false)
    }
  }, [])

  const removeWallpaper = useCallback(async () => {
    await deleteWallpaperBlob()
    if (wallpaperUrlRef.current) {
      URL.revokeObjectURL(wallpaperUrlRef.current)
      wallpaperUrlRef.current = null
    }
    setWallpaperUrl(null)
    setWallpaperSeed(null)
    setWallpaperError('')
    setPrefs((current) => ({
      ...current,
      wallpaper: { ...current.wallpaper, enabled: false, name: '' },
    }))
  }, [])

  const reloadWallpaper = useCallback(async () => {
    try {
      const blob = await loadWallpaperBlob()
      if (!blob) return
      const seed = await extractWallpaperSeed(blob)
      const url = URL.createObjectURL(blob)
      if (wallpaperUrlRef.current) URL.revokeObjectURL(wallpaperUrlRef.current)
      wallpaperUrlRef.current = url
      setWallpaperUrl(url)
      setWallpaperSeed(seed)
    } catch {
      setWallpaperError('The imported wallpaper could not be read')
    }
  }, [])

  const setWallpaperOptions = useCallback((patch: Partial<WallpaperOptions>) => {
    setPrefs((current) => ({ ...current, wallpaper: { ...current.wallpaper, ...patch } }))
  }, [])

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
      setDistanceUnit: (distanceUnit) => setPrefs((p) => ({ ...p, distanceUnit })),
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
      wallpaperUrl,
      wallpaperSeed,
      wallpaperPalette,
      wallpaperBusy,
      wallpaperError,
      setWallpaperFile,
      removeWallpaper,
      reloadWallpaper,
      setWallpaperOptions,
    }),
    [
      prefs,
      wallpaperUrl,
      wallpaperSeed,
      wallpaperPalette,
      wallpaperBusy,
      wallpaperError,
      setWallpaperFile,
      removeWallpaper,
      reloadWallpaper,
      setWallpaperOptions,
    ],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
