import { useEffect, useRef, useState } from 'react'
import {
  BellRing,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ImageOff,
  Moon,
  Palette,
  Sun,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext'
import { exportData, importData, saveJsonFile } from '../lib/exportImport'
import { THEMES } from '../lib/themes'
import type { HomeSection, ThemeMode } from '../db/types'
import { clearAllData } from '../db/db'
import { isNative, notificationsGranted, requestNotifications } from '../lib/native'
import { findMissingImages, repairImagesFromFiles, repairImagesFromFolder } from '../lib/noteImages'
import { clearActiveSession } from '../lib/pomodoroStore'
import { ConfirmDialog, Dialog, Field, PageHeader, TextInput } from '../components/ui'

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
    importPreferences,
  } = usePreferences()

  const [showEdit, setShowEdit] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState('')
  const [importState, setImportState] = useState<ImportState>({ kind: 'idle' })
  const [open, setOpen] = useState({
    profile: true,
    appearance: true,
    home: true,
    permissions: true,
    data: true,
  })
  const [missingImages, setMissingImages] = useState(0)
  const [repairing, setRepairing] = useState(false)
  const [imageNote, setImageNote] = useState('')
  const [notifications, setNotifications] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pendingImageIds = useRef<string[]>([])

  const refreshMissingImages = async () => {
    const { ids } = await findMissingImages()
    setMissingImages(ids.length)
  }

  useEffect(() => {
    void refreshMissingImages()
    void notificationsGranted().then(setNotifications)
  }, [])

  const doExport = async () => {
    setExporting(true)
    try {
      const json = await exportData(prefs)
      setExportNote(await saveJsonFile(`clarity_export_${new Date().toISOString().slice(0, 10)}.json`, json))
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
      const total = Object.values(result.counts).reduce((s, n) => s + n, 0)
      setImportState({ kind: 'success', summary: `${total} records restored across ${Object.keys(result.counts).length} tables.` })
    } catch (e) {
      setImportState({ kind: 'error', message: e instanceof Error ? e.message : 'Import failed' })
    }
  }

  /** Try the old app's folder first, then fall back to the system file picker. */
  const doRepairImages = async () => {
    setRepairing(true)
    setImageNote('')
    try {
      const { ids } = await findMissingImages()
      if (ids.length === 0) {
        setMissingImages(0)
        setImageNote('Every note image is already available.')
        return
      }

      if (isNative()) {
        const folder = await repairImagesFromFolder(ids)
        if (folder.recovered > 0) {
          const left = ids.length - folder.recovered
          setMissingImages(left)
          setImageNote(
            `Restored ${folder.recovered} image${folder.recovered === 1 ? '' : 's'} from clarity/pics` +
              (left > 0 ? ` — ${left} still missing.` : '.'),
          )
          return
        }
      }

      // No folder access (or nothing found): let the user pick the files.
      pendingImageIds.current = ids
      imageInputRef.current?.click()
    } finally {
      setRepairing(false)
    }
  }

  const doRepairFromPicker = async (files: File[]) => {
    setRepairing(true)
    setImageNote('')
    try {
      const result = await repairImagesFromFiles(files, pendingImageIds.current)
      await refreshMissingImages()
      if (result.recovered === 0) {
        setImageNote('No picked file matched a note image. Pick the files from clarity/pics.')
      } else {
        setImageNote(
          `Restored ${result.recovered} image${result.recovered === 1 ? '' : 's'}` +
            (result.unmatched > 0 ? `, ${result.unmatched} file(s) did not match.` : '.'),
        )
      }
    } finally {
      setRepairing(false)
      pendingImageIds.current = []
    }
  }

  const doClearData = async () => {
    setClearing(true)
    try {
      await clearAllData()
      clearActiveSession()
      setMissingImages(0)
      setConfirmClear(false)
      setImportState({ kind: 'idle' })
      setExportNote('')
      setImageNote('')
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
        <button className="collapse-head" aria-expanded={open.profile} onClick={() => setOpen((v) => ({ ...v, profile: !v.profile }))}>
          <span className="section-label">Profile</span>
          <span className={`chevron ${open.profile ? 'open' : ''}`}>⌄</span>
        </button>
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
          </div>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <button className="collapse-head" aria-expanded={open.appearance} onClick={() => setOpen((v) => ({ ...v, appearance: !v.appearance }))}>
          <span className="section-label">Appearance</span>
          <span className={`chevron ${open.appearance ? 'open' : ''}`}>⌄</span>
        </button>

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
              <div className="segmented" style={{ marginTop: 12, width: '100%' }}>
                {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={prefs.darkMode === mode ? 'active' : ''}
                    style={{ flex: 1, textTransform: 'capitalize' }}
                    onClick={() => setDarkMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
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
            </div>
          </>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <button className="collapse-head" aria-expanded={open.home} onClick={() => setOpen((v) => ({ ...v, home: !v.home }))}>
          <span className="section-label">Home Page</span>
          <span className={`chevron ${open.home ? 'open' : ''}`}>⌄</span>
        </button>
        {open.home && (
          <div className="card" style={{ marginTop: 8 }}>
            <p className="small muted" style={{ marginBottom: 6 }}>
              Choose which sections appear on the home screen and in what order.
            </p>
            {prefs.sectionOrder.map((section, index) => sectionRow(section, index))}
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
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
        <button
          className="collapse-head"
          aria-expanded={open.permissions}
          onClick={() => setOpen((v) => ({ ...v, permissions: !v.permissions }))}
        >
          <span className="section-label">Permissions</span>
          <span className={`chevron ${open.permissions ? 'open' : ''}`}>⌄</span>
        </button>
        {open.permissions && (
          <div className="card flush" style={{ marginTop: 8 }}>
            <button
              className="list-item"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: 16, cursor: 'pointer' }}
              onClick={() => void requestNotifications().then(setNotifications)}
              disabled={!isNative()}
            >
              <div className="avatar"><BellRing size={19} /></div>
              <div className="grow">
                <div className="bold">Notifications</div>
                <div className="small muted">
                  {!isNative()
                    ? 'Only used by the Android app (timer alarms)'
                    : notifications
                      ? 'Allowed — timer alarms can notify you in the background'
                      : 'Tap to allow timer alarms outside the app'}
                </div>
              </div>
              {isNative() && (
                <span className="small" style={{ color: notifications ? 'var(--primary)' : 'var(--error)', fontWeight: 600 }}>
                  {notifications ? 'Allowed' : 'Off'}
                </span>
              )}
            </button>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <button className="collapse-head" aria-expanded={open.data} onClick={() => setOpen((v) => ({ ...v, data: !v.data }))}>
          <span className="section-label">Data</span>
          <span className={`chevron ${open.data ? 'open' : ''}`}>⌄</span>
        </button>
        {open.data && (
          <div className="card flush" style={{ marginTop: 8 }}>
            <button
              className="list-item"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: 16, cursor: 'pointer' }}
              onClick={() => void doExport()}
              disabled={exporting}
            >
              <div className="avatar"><Download size={19} /></div>
              <div className="grow">
                <div className="bold">Export data</div>
                <div className="small muted">
                  {exporting ? 'Exporting…' : exportNote || 'Save everything as JSON (Android compatible)'}
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
            <button
              className="list-item"
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: 16, cursor: 'pointer' }}
              onClick={() => void doRepairImages()}
              disabled={repairing}
            >
              <div className="avatar"><ImageOff size={19} /></div>
              <div className="grow">
                <div className="bold">Repair note images</div>
                <div className="small muted">
                  {repairing
                    ? 'Looking for images…'
                    : imageNote ||
                      (missingImages > 0
                        ? `${missingImages} image${missingImages === 1 ? '' : 's'} referenced by notes but not stored — tap to re-link from clarity/pics`
                        : 'All note images are present')}
                </div>
              </div>
            </button>
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
                <div className="small muted">Delete tasks, notes, habits and money data — your name and theme stay</div>
              </div>
            </button>
          </div>
        )}
      </section>

      <p className="tiny muted" style={{ textAlign: 'center' }}>
        Clarity 1.0.0 · data stored locally on this device
      </p>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) void doRepairFromPicker(files)
          e.target.value = ''
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear all data?"
        message={
          clearing
            ? 'Clearing…'
            : 'This deletes every task, note, habit, transaction, goal and event. Your name, theme and home layout are kept. This cannot be undone.'
        }
        confirmLabel={clearing ? 'Clearing…' : 'Clear data'}
        onConfirm={() => void doClearData()}
        onCancel={() => setConfirmClear(false)}
      />

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void doImport(file)
          e.target.value = ''
        }}
      />

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
