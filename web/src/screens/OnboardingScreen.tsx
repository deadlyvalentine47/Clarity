import { useRef, useState } from 'react'
import { Sparkles, Upload } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext'
import { importData } from '../lib/exportImport'

export default function OnboardingScreen() {
  const { setUsername, importPreferences } = usePreferences()
  const [step, setStep] = useState<'welcome' | 'name'>('welcome')
  const [name, setName] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const onImport = async (file: File) => {
    setImporting(true)
    setError('')
    try {
      const result = await importData(await file.text())
      importPreferences(result.preferences)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-logo">
          <Sparkles size={34} />
        </div>

        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1px' }}>Welcome to Clarity</h1>
        <p className="muted" style={{ marginTop: 8 }}>Your personal management app</p>

        {step === 'welcome' ? (
          <>
            <p style={{ marginTop: 36 }}>Restore your data from a backup or start fresh.</p>

            <div className="stack" style={{ marginTop: 20 }}>
              <button className="btn btn-primary btn-block" onClick={() => fileRef.current?.click()} disabled={importing}>
                <Upload size={18} /> {importing ? 'Importing…' : 'Import data'}
              </button>
              <button className="btn btn-outline btn-block" onClick={() => setStep('name')}>
                Start fresh
              </button>
            </div>

            {error && <p className="small" style={{ color: 'var(--error)', marginTop: 14 }}>Import failed: {error}</p>}
            <p className="tiny muted" style={{ marginTop: 20 }}>
              Backups exported from the Android app work here too.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>What should we call you?</h2>
            <form
              style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim()) setUsername(name.trim())
              }}
            >
              <input
                className="input"
                placeholder="Your name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Your name"
              />
              <button className="btn btn-primary btn-block" type="submit" disabled={!name.trim()}>
                Get Started
              </button>
              <button type="button" className="btn btn-outline btn-block" onClick={() => setStep('welcome')}>
                Back
              </button>
            </form>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onImport(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
