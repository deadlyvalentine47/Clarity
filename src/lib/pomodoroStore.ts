// Port of PomodoroTimerManager + PomodoroViewModel. The Android app keeps the
// timer in a process-wide object; here a module-level store does the same and
// also persists to localStorage so a reload doesn't lose the session.
import { db } from '../db/db'
import { cancelTimerNotification, scheduleTimerNotification } from './native'
import type { PomodoroFocusSession } from '../db/types'

export interface PomodoroState {
  isRunning: boolean
  isPaused: boolean
  timeLeftSeconds: number
  isBreak: boolean
  sessionCount: number
  totalFocusMinutes: number
  distractions: string[]
  focusDurationMinutes: number
  breakDurationMinutes: number
  isAlarmPlaying: boolean
  title: string
  focusSessionId: number
  focusInput: string
  breakInput: string
}

const DEFAULT_STATE: PomodoroState = {
  isRunning: false,
  isPaused: false,
  timeLeftSeconds: 25 * 60,
  isBreak: false,
  sessionCount: 0,
  totalFocusMinutes: 0,
  distractions: [],
  focusDurationMinutes: 25,
  breakDurationMinutes: 5,
  isAlarmPlaying: false,
  title: '',
  focusSessionId: 0,
  focusInput: '25',
  breakInput: '5',
}

const STORAGE_KEY = 'clarity.pomodoro'

function load(): PomodoroState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const saved = JSON.parse(raw) as Partial<PomodoroState>
    const merged = { ...DEFAULT_STATE, ...saved }
    // A reload can't know how much time actually elapsed; resume paused.
    if (merged.isRunning) {
      merged.isRunning = false
      merged.isPaused = true
    }
    merged.isAlarmPlaying = false
    return merged
  } catch {
    return { ...DEFAULT_STATE }
  }
}

let state: PomodoroState = load()
const listeners = new Set<() => void>()
let intervalId: number | null = null
let endAt = 0
let alarmTimer: number | null = null
let audioCtx: AudioContext | null = null

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

function emit() {
  persist()
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getState(): PomodoroState {
  return state
}

function setState(patch: Partial<PomodoroState>) {
  state = { ...state, ...patch }
  emit()
}

function clearTicker() {
  if (intervalId != null) {
    window.clearInterval(intervalId)
    intervalId = null
  }
}

function tick() {
  const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000))
  if (remaining !== state.timeLeftSeconds) {
    state = { ...state, timeLeftSeconds: remaining }
    emit()
  }
  if (remaining <= 0) complete()
}

export function startTimer() {
  if (state.focusDurationMinutes <= 0 || state.breakDurationMinutes <= 0) return
  ensureAudio()
  clearTicker()
  if (state.timeLeftSeconds <= 0) {
    state = { ...state, timeLeftSeconds: (state.isBreak ? state.breakDurationMinutes : state.focusDurationMinutes) * 60 }
  }
  endAt = Date.now() + state.timeLeftSeconds * 1000
  state = { ...state, isRunning: true, isPaused: false }
  emit()
  intervalId = window.setInterval(tick, 250)
  void scheduleTimerNotification(state.timeLeftSeconds, state.isBreak)
}

export function pauseTimer() {
  clearTicker()
  setState({ isRunning: false, isPaused: true })
  void cancelTimerNotification()
}

export function resetTimer() {
  clearTicker()
  const duration = (state.isBreak ? state.breakDurationMinutes : state.focusDurationMinutes) * 60
  setState({ isRunning: false, isPaused: false, timeLeftSeconds: duration })
  void cancelTimerNotification()
}

function complete() {
  clearTicker()
  if (!state.isBreak) {
    const duration = state.focusDurationMinutes
    state = {
      ...state,
      isRunning: false,
      sessionCount: state.sessionCount + 1,
      totalFocusMinutes: state.totalFocusMinutes + duration,
      isAlarmPlaying: true,
      isBreak: true,
      timeLeftSeconds: state.breakDurationMinutes * 60,
    }
    emit()
    void db.pomodoroSessions.add({
      taskId: null,
      duration,
      type: 'Focus',
      completedAt: Date.now(),
      distractions: [],
    })
  } else {
    state = {
      ...state,
      isRunning: false,
      isBreak: false,
      timeLeftSeconds: state.focusDurationMinutes * 60,
      isAlarmPlaying: true,
    }
    emit()
  }
  void saveFocusSession()
  playAlarm()
}

export function dismissAlarm() {
  stopAlarm()
  setState({ isAlarmPlaying: false })
  void cancelTimerNotification()
}

export function stopAlarm() {
  if (alarmTimer != null) {
    window.clearInterval(alarmTimer)
    alarmTimer = null
  }
  try {
    navigator.vibrate?.(0)
  } catch {
    /* ignore */
  }
}

function ensureAudio() {
  try {
    audioCtx ??= new AudioContext()
    void audioCtx.resume()
  } catch {
    /* audio not available */
  }
}

function playAlarm() {
  stopAlarm()
  ensureAudio()
  try {
    const beep = () => {
      if (!audioCtx) return
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.5)
    }
    beep()
    alarmTimer = window.setInterval(beep, 1200)
    navigator.vibrate?.([500, 200, 500, 200, 500])
  } catch {
    /* audio not available */
  }
}

export function setFocusDuration(text: string) {
  const digits = text.replace(/\D/g, '')
  const num = digits ? Number(digits) : null
  const patch: Partial<PomodoroState> = { focusInput: text }
  if (num != null && num >= 1 && num <= 90) {
    patch.focusDurationMinutes = num
    if (!state.isBreak && !state.isRunning && !state.isPaused) {
      patch.timeLeftSeconds = num * 60
    }
  }
  setState(patch)
  void saveFocusSession()
}

export function setBreakDuration(text: string) {
  const digits = text.replace(/\D/g, '')
  const num = digits ? Number(digits) : null
  const patch: Partial<PomodoroState> = { breakInput: text }
  if (num != null && num >= 1 && num <= 30) {
    patch.breakDurationMinutes = num
    if (state.isBreak && !state.isRunning && !state.isPaused) {
      patch.timeLeftSeconds = num * 60
    }
  }
  setState(patch)
  void saveFocusSession()
}

export function logDistraction(distraction: string) {
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  setState({ distractions: [...state.distractions, `${distraction} - ${time}`] })
  void saveFocusSession()
}

export function syncFromSession(session: PomodoroFocusSession) {
  if (state.focusSessionId === session.id && (state.isRunning || state.isPaused)) return
  state = {
    ...DEFAULT_STATE,
    title: session.title,
    focusDurationMinutes: session.focusDurationMinutes,
    breakDurationMinutes: session.breakDurationMinutes,
    sessionCount: session.sessionCount,
    totalFocusMinutes: session.totalFocusMinutes,
    distractions: session.distractions
      ? session.distractions.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    timeLeftSeconds: session.focusDurationMinutes * 60,
    focusSessionId: session.id ?? 0,
    focusInput: String(session.focusDurationMinutes),
    breakInput: String(session.breakDurationMinutes),
  }
  emit()
}

export async function loadSession(sessionId: number) {
  if (sessionId <= 0) return
  if (state.focusSessionId === sessionId && (state.isRunning || state.isPaused)) return
  const session = await db.pomodoroFocusSessions.get(sessionId)
  if (session) syncFromSession(session)
}

async function saveFocusSession() {
  if (state.focusSessionId <= 0) return
  await db.pomodoroFocusSessions.update(state.focusSessionId, {
    title: state.title,
    focusDurationMinutes: state.focusDurationMinutes,
    breakDurationMinutes: state.breakDurationMinutes,
    sessionCount: state.sessionCount,
    totalFocusMinutes: state.totalFocusMinutes,
    distractions: state.distractions.join(', '),
    updatedAt: Date.now(),
  })
}

export function createSession(title: string): Promise<number> {
  const now = Date.now()
  return db.pomodoroFocusSessions.add({
    title,
    focusDurationMinutes: 25,
    breakDurationMinutes: 5,
    sessionCount: 0,
    totalFocusMinutes: 0,
    distractions: '',
    createdAt: now,
    updatedAt: now,
  }) as Promise<number>
}

/** Reset the in-memory timer (used after deleting the active session). */
export function clearActiveSession() {
  clearTicker()
  stopAlarm()
  state = { ...DEFAULT_STATE }
  emit()
}
