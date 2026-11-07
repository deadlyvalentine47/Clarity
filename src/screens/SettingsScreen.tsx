import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FolderDown,
  ImagePlus,
  Moon,
  Palette,
  Ruler,
  Share2,
  Sun,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext'
import { exportData, exportToDevice, importData, shareExport } from '../lib/exportImport'
import { THEMES } from '../lib/themes'
import type { HomeSection, ThemeMode } from '../db/types'
import { clearAllData } from '../db/db'
import { isNative, nativePlatform } from '../lib/native'
import { backupStatus, type BackupStatus } from '../lib/backupScheduler'
import { discardRun } from '../lib/runStore'
import { CollapsibleHeader, ConfirmDialog, Dialog, Field, PageHeader, Segmented, TextInput } from '../components/ui'

type ImportState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; summary: string }
  | { kind: 'error'; message: string }

export default function SettingsScreen() {
  const {
    prefs,
    setUsername,
    setTheme,
    setDarkMode,
    setSectionOrder,
    setSectionEnabled,
    toggleSection,
    moveSection,
    setDistanceUnit,
    importPreferences,
    wallpaperUrl,
    wallpaperPalette,
    wallpaperBusy,
    wallpaperError,
    setWallpaperFile,
    removeWallpaper,
    reloadWallpaper,
    setWallpaperOptions,
  } = usePreferences()

  const [showEdit, setShowEdit] = useState(false)
  const [showUnit, setShowUnit] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [importState, setImportState] = useState<ImportState>({ kind: 'idle' })
  const [open, setOpen] = useState({
    profile: true,
    appearance: true,
    home: true,
    data: true,
  })
  const [backupInfo, setBackupInfo] = useState<BackupStatus | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const wallpaperRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNative()) void backupStatus().then(setBackupInfo)
  }, [])

  const runExport = async (mode: 'save' | 'share') => {
    setShowExport(false)
    setExporting(true)
    setExportNote('')
    try {
      const json = await exportData(prefs)
      const filename = `clarity_export_${new Date().toISOString().slice(0, 10)}.json`
      setExportNote(mode === 'save' ? await exportToDevice(filename, json) : await shareExport(filename, json))
    } catch (e) {
      setExportNote(`Export failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setExporting(false)
    }
  }

  const doImport = async (file: File) => {
    setImportState({ kind: 'loading' })
    try {
      const text = await file.text()
      const result = await importData(text)
      importPreferences(result.preferences)
      await reloadWallpaper()
      const total = Object.values(result.counts).reduce((s, n) => s + n, 0)
      setImportState({ kind: 'success', summary: `${total} records restored across ${Object.keys(result.counts).length} tables.` })
    } catch (e) {
      setImportState({ kind: 'error', message: e instanceof Error ? e.message : 'Import failed' })
    }
  }

  const doClearData = async () => {
    setClearing(true)
    try {
      await clearAllData()
      discardRun()
      setConfirmClear(false)
      setImportState({ kind: 'idle' })
      setExportNote('')
      setOpen((v) => ({ ...v, data: true }))
    } finally {
      setClearing(false)
    }
  }

  const sectionRow = (section: HomeSection, index: number) => {
    const enabled = prefs.sectionEnabled.includes(section)
    return (
      <div key={section} className="section-config-row">
        <button
          className={`switch ${enabled ? 'on' : ''}`}
          aria-label={`Toggle ${section}`}
          aria-pressed={enabled}
          onClick={() => toggleSection(section)}
        />
        <span className="grow">{section}</span>
        <button
          className="icon-btn"
          style={{ width: 34, height: 34 }}
          aria-label={`Move ${section} up`}
          disabled={index === 0}
          onClick={() => moveSection(section, -1)}
        >
          <ChevronUp size={16} />
        </button>
        <button
          className="icon-btn"
          style={{ width: 34, height: 34 }}
          aria-label={`Move ${section} down`}
          disabled={index === prefs.sectionOrder.length - 1}
          onClick={() => moveSection(section, 1)}
        >
          <ChevronDown size={16} />
        </button>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Profile, appearance, home page and data" />

      <section style={{ marginBottom: 20 }}>
        <CollapsibleHeader
          title="Profile"
          open={open.profile}
          onToggle={() => setOpen((v) => ({ ...v, profile: !v.profile }))}
        />
        {open.profile && (
          <div className="card flush" style={{ marginTop: 8 }}>
            <button
              className="list-item"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: 16, cursor: 'pointer' }}
              onClick={() => {
                setEditValue(prefs.username)
                setShowEdit(true)
              }}
            >
              <div className="avatar primary"><User size={20} /></div>
              <div className="grow">
                <div className="bold">{prefs.username || 'Not set'}</div>
                <div className="small muted">Username</div>
              </div>
              <span className="small" style={{ color: 'var(--primary)', fontWeight: 600 }}>Edit</span>
            </button>
            <button
              className="list-item"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: 16, cursor: 'pointer' }}
              onClick={() => setShowUnit(true)}
            >
              <div className="avatar"><Ruler size={19} /></div>
              <div className="grow">
                <div className="bold">Distance unit</div>
                <div className="small muted">
                  {prefs.distanceUnit === 'km' ? 'Kilometres (km)' : 'Miles (mi)'}
                </div>
              </div>
              <span className="small" style={{ color: 'var(--primary)', fontWeight: 600 }}>Change</span>
            </button>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <CollapsibleHeader
          title="Appearance"
          open={open.appearance}
          onToggle={() => setOpen((v) => ({ ...v, appearance: !v.appearance }))}
        />

        {open.appearance && (
          <>
            <div className="card" style={{ marginTop: 8 }}>
              <div className="row-between">
                <div className="row">
                  <div className="avatar">{prefs.darkMode === 'dark' ? <Moon size={20} /> : <Sun size={20} />}</div>
                  <div>
                    <div className="bold">Theme mode</div>
                    <div className="small muted">
                      {prefs.darkMode === 'system' ? 'Follows your device' : prefs.darkMode === 'dark' ? 'Always dark' : 'Always light'}
                    </div>
                  </div>
                </div>
              </div>
              <Segmented
                value={prefs.darkMode}
                onChange={setDarkMode}
                label="Theme mode"
                style={{ marginTop: 12, width: '100%' }}
                itemStyle={{ flex: 1, textTransform: 'capitalize' }}
                options={[
                  { value: 'system', label: 'system' },
                  { value: 'light', label: 'light' },
                  { value: 'dark', label: 'dark' },
                ]}
              />
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <Palette size={18} className="muted" />
                <span className="bold">Colour theme</span>
              </div>
              {Object.values(THEMES).map((theme) => (
                <button key={theme.name} className="theme-row" onClick={() => setTheme(theme.name)}>
                  <span className="theme-dot" style={{ background: theme.primary }} />
                  <span className="grow" style={{ fontWeight: prefs.theme === theme.name ? 700 : 500 }}>{theme.name}</span>
                  {prefs.theme === theme.name && <Check size={18} color="var(--primary)" />}
                </button>
              ))}
              {wallpaperUrl && prefs.wallpaper.tint && (
                <p className="tiny muted" style={{ marginTop: 10 }}>
                  While a wallpaper is active its palette replaces the colour theme above.
                </p>
              )}
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <div className="row-between" style={{ alignItems: 'flex-start' }}>
                <div className="row">
                  <div className="avatar"><ImagePlus size={20} /></div>
                  <div>
                    <div className="bold">Wallpaper</div>
                    <div className="small muted">
                      {wallpaperUrl
                        ? prefs.wallpaper.enabled
                          ? prefs.wallpaper.tint
                            ? 'Colours on every screen come from this photo'
                            : 'Shown behind the interface'
                          : 'Saved, currently turned off'
                        : 'Put a photo behind every screen'}
                    </div>
                  </div>
                </div>
                <button
                  className={`btn btn-sm ${wallpaperUrl ? 'btn-outline' : 'btn-primary'}`}
                  onClick={() => wallpaperRef.current?.click()}
                  disabled={wallpaperBusy}
                >
                  {wallpaperBusy ? 'Working…' : wallpaperUrl ? 'Change' : 'Choose'}
                </button>
              </div>

              {wallpaperUrl && (
                <>
                  <div
                    className="wallpaper-preview"
                    style={{ backgroundImage: `url("${wallpaperUrl}")` }}
                  >
                    {wallpaperPalette && (
                      <div className="wallpaper-swatches" aria-hidden="true">
                        <span className="wallpaper-swatch" style={{ background: wallpaperPalette.primary }} />
                        <span className="wallpaper-swatch" style={{ background: wallpaperPalette.secondary }} />
                        <span className="wallpaper-swatch" style={{ background: wallpaperPalette.surface }} />
                        <span className="wallpaper-swatch" style={{ background: wallpaperPalette.text }} />
                      </div>
                    )}
                  </div>

                  <div className="wallpaper-actions">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => setWallpaperOptions({ enabled: !prefs.wallpaper.enabled })}
                    >
                      {prefs.wallpaper.enabled ? 'Turn off' : 'Turn on'}
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={() => void removeWallpaper()}>
                      Remove
                    </button>
                  </div>

                  <div className="wallpaper-row">
                    <div className="grow">
                      <div className="bold">Tint from wallpaper</div>
                      <div className="small muted">Recolour the interface to match the photo</div>
                    </div>
                    <button
                      className={`switch ${prefs.wallpaper.tint ? 'on' : ''}`}
                      aria-label="Tint the interface from the wallpaper"
                      aria-pressed={prefs.wallpaper.tint}
                      onClick={() => setWallpaperOptions({ tint: !prefs.wallpaper.tint })}
                    />
                  </div>

                  <div className="wallpaper-dim">
                    <div className="row-between">
                      <span className="small muted">Background dim</span>
                      <span className="small muted">{Math.round(prefs.wallpaper.dim * 100)}%</span>
                    </div>
                    <input
                      className="slider"
                      type="range"
                      min={20}
                      max={85}
                      step={5}
                      value={Math.round(prefs.wallpaper.dim * 100)}
                      onChange={(event) => setWallpaperOptions({ dim: Number(event.target.value) / 100 })}
                      aria-label="Wallpaper dim"
                    />
                  </div>
                </>
              )}

              {wallpaperError && (
                <div className="small" style={{ color: 'var(--error)', marginTop: 8 }}>{wallpaperError}</div>
              )}
            </div>
          </>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <CollapsibleHeader
          title="Home Page"
          open={open.home}
          onToggle={() => setOpen((v) => ({ ...v, home: !v.home }))}
        />
        {open.home && (
          <div className="card" style={{ marginTop: 8 }}>
            <p className="small muted" style={{ marginBottom: 6 }}>
              Choose which sections appear on the home screen and in what order.
            </p>
            {prefs.sectionOrder.map((section, index) => sectionRow(section, index))}
            <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setSectionEnabled([...prefs.sectionOrder])}>
                Enable all
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => setSectionEnabled([])}>
                Hide all
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => setSectionOrder([...prefs.sectionOrder].reverse())}>
                Reverse order
              </button>
            </div>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <CollapsibleHeader
          title="Data"
          open={open.data}
          onToggle={() => setOpen((v) => ({ ...v, data: !v.data }))}
        />
        {open.data && (
          <div className="card flush" style={{ marginTop: 8 }}>
            <button
              className="list-item"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: 16, cursor: 'pointer' }}
              onClick={() => (isNative() ? setShowExport(true) : void runExport('save'))}
              disabled={exporting}
            >
              <div className="avatar"><Download size={19} /></div>
              <div className="grow">
                <div className="bold">Export data</div>
                <div className="small muted">
                  {exporting
                    ? 'Exporting…'
                    : exportNote ||
                      'Save to this device or share it — JSON, Android compatible'}
                </div>
              </div>
            </button>
            <button
              className="list-item"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: 16, cursor: 'pointer' }}
              onClick={() => fileRef.current?.click()}
              disabled={importState.kind === 'loading'}
            >
              <div className="avatar"><Upload size={19} /></div>
              <div className="grow">
                <div className="bold">Import data</div>
                <div className="small muted">{importState.kind === 'loading' ? 'Importing…' : 'Restore from a JSON backup (replaces current data)'}</div>
              </div>
            </button>
            {isNative() && (
              <div className="list-item" style={{ padding: 16 }}>
                <div className="avatar"><FolderDown size={19} /></div>
                <div className="grow">
                  <div className="bold">Nightly backup</div>
                  <div className="small muted">
                    {backupInfo?.lastBackupAt
                      ? `Last: ${new Date(backupInfo.lastBackupAt).toLocaleString()} · ${backupInfo.lastBackupFile}`
                      : nativePlatform() === 'ios'
                        ? 'Kept in Files → Clarity'
                        : 'Runs daily at 11:30 PM to Downloads/Clarity'}
                  </div>
                  {nativePlatform() === 'ios' ? (
                    <div className="tiny muted">
                      Updated when the app is backgrounded; the 11:30 PM run is best-effort on iOS.
                    </div>
                  ) : null}
                  {backupInfo?.lastError ? (
                    <div className="tiny" style={{ color: 'var(--error)' }}>{backupInfo.lastError}</div>
                  ) : null}
                </div>
              </div>
            )}
            <button
              className="list-item"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: 16, cursor: 'pointer' }}
              onClick={() => setConfirmClear(true)}
            >
              <div className="avatar" style={{ background: 'var(--error-container)', color: 'var(--error)' }}>
                <Trash2 size={19} />
              </div>
              <div className="grow">
                <div className="bold" style={{ color: 'var(--error)' }}>Clear data</div>
                <div className="small muted">Delete notes, habits, events and money data — your name and theme stay</div>
              </div>
            </button>
          </div>
        )}
      </section>

      <p className="tiny muted" style={{ textAlign: 'center' }}>
        Clarity 1.0.0 · data stored locally on this device
      </p>

      <ConfirmDialog
        open={pendingImport != null}
        title="Import backup?"
        message="Importing replaces every note, habit, event and transaction currently stored on this device. This cannot be undone — export first if you want to keep the current data."
        confirmLabel="Import"
        onConfirm={() => {
          const file = pendingImport
          setPendingImport(null)
          if (file) void doImport(file)
        }}
        onCancel={() => setPendingImport(null)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear all data?"
        message={
          clearing
            ? 'Clearing…'
            : 'This deletes every note, habit, transaction, goal and event. Your name, theme, wallpaper and home layout are kept. This cannot be undone.'
        }
        confirmLabel={clearing ? 'Clearing…' : 'Clear data'}
        onConfirm={() => void doClearData()}
        onCancel={() => setConfirmClear(false)}
      />

      <Dialog open={showExport} onClose={() => setShowExport(false)} title="Export data">
        <p className="small muted" style={{ marginBottom: 12 }}>
          The backup is a single JSON file with everything, including note pictures.
        </p>
        <div className="stack" style={{ gap: 10 }}>
          <button className="btn btn-primary btn-block" onClick={() => void runExport('save')}>
            <FolderDown size={18} /> Save to this device
          </button>
          <button className="btn btn-outline btn-block" onClick={() => void runExport('share')}>
            <Share2 size={18} /> Share
          </button>
        </div>
      </Dialog>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) setPendingImport(file)
          e.target.value = ''
        }}
      />

      <input
        ref={wallpaperRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void setWallpaperFile(file)
          e.target.value = ''
        }}
      />

      <Dialog
        open={showUnit}
        onClose={() => setShowUnit(false)}
        title="Distance unit"
        footer={
          <button className="btn btn-primary btn-block" onClick={() => setShowUnit(false)}>
            Done
          </button>
        }
      >
        <div className="stack" style={{ gap: 8 }}>
          {([
            ['km', 'Kilometres (km)'],
            ['mi', 'Miles (mi)'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              className={`list-item ${prefs.distanceUnit === value ? 'active' : ''}`}
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: 14, cursor: 'pointer' }}
              onClick={() => {
                setDistanceUnit(value)
                setShowUnit(false)
              }}
            >
              <div className="avatar"><Ruler size={19} /></div>
              <div className="grow">
                <div className="bold">{label}</div>
                <div className="small muted">
                  {value === 'km'
                    ? 'Runs and pace are shown in kilometres.'
                    : 'Runs and pace are shown in miles.'}
                </div>
              </div>
              {prefs.distanceUnit === value && <Check size={18} color="var(--primary)" />}
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Username"
        footer={
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowEdit(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (editValue.trim()) setUsername(editValue.trim())
                setShowEdit(false)
              }}
            >
              Save
            </button>
          </div>
        }
      >
        <Field label="Username">
          <TextInput autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} />
        </Field>
      </Dialog>

      <Dialog
        open={importState.kind === 'success' || importState.kind === 'error'}
        onClose={() => setImportState({ kind: 'idle' })}
        title={importState.kind === 'success' ? 'Import Successful' : 'Import Failed'}
        footer={
          <button className="btn btn-primary btn-block" onClick={() => setImportState({ kind: 'idle' })}>OK</button>
        }
      >
        <p className="muted">
          {importState.kind === 'success'
            ? importState.summary
            : importState.kind === 'error'
              ? importState.message
              : ''}
        </p>
      </Dialog>
    </>
  )
}
