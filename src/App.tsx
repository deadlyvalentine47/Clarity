import { useCallback, useEffect, useRef, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { usePreferences } from './context/PreferencesContext'
import { markMissedDaysForAll } from './db/habits'
import { clearHabitsIfDue, startHabitMonthlyCleanup } from './db/housekeeping'
import { exitApp, registerBackButton, requestStartupPermissions } from './lib/native'
import OnboardingScreen from './screens/OnboardingScreen'
import HomeScreen from './screens/HomeScreen'
import CalendarScreen from './screens/CalendarScreen'
import BudgetScreen from './screens/BudgetScreen'
import AccountsScreen from './screens/budget/AccountsScreen'
import AccountDetailScreen from './screens/budget/AccountDetailScreen'
import CreditCardsScreen from './screens/budget/CreditCardsScreen'
import CreditCardDetailScreen from './screens/budget/CreditCardDetailScreen'
import InvestmentsScreen from './screens/budget/InvestmentsScreen'
import BudgetMetricsScreen from './screens/budget/MetricsScreen'
import ActivityScreen from './screens/budget/ActivityScreen'
import HabitsScreen from './screens/HabitsScreen'
import HabitDetailScreen from './screens/HabitDetailScreen'
import HabitMetricsScreen from './screens/HabitMetricsScreen'
import HabitDayScreen from './screens/HabitDayScreen'
import NotesScreen from './screens/NotesScreen'
import NoteDetailScreen from './screens/NoteDetailScreen'
import GoalsScreen from './screens/GoalsScreen'
import PomodoroListScreen from './screens/PomodoroListScreen'
import PomodoroScreen from './screens/PomodoroScreen'
import SettingsScreen from './screens/SettingsScreen'
import NotFoundScreen from './screens/NotFoundScreen'

export default function App() {
  const { firstLaunch } = usePreferences()
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const backArmed = useRef(false)
  const backTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2400)
  }, [])

  // Delete last month's habits before doing anything else, then fill in
  // missing past days as missed without overwriting explicit completions.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      await clearHabitsIfDue()
      if (!cancelled) await markMissedDaysForAll()
    })()
    void requestStartupPermissions()
    const stopCleanup = startHabitMonthlyCleanup()
    return () => {
      cancelled = true
      stopCleanup()
    }
  }, [])

  // Android back: leave the screen first, only quit from home (and only after
  // a second press, so one stray press doesn't close the app).
  useEffect(
    () =>
      registerBackButton(() => {
        if (backArmed.current) {
          void exitApp()
          return
        }
        backArmed.current = true
        showToast('Press back again to exit')
        window.clearTimeout(backTimer.current)
        backTimer.current = window.setTimeout(() => {
          backArmed.current = false
        }, 2000)
      }),
    [showToast],
  )

  if (firstLaunch) {
    return <OnboardingScreen />
  }

  return (
    <>
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeScreen />} />
        <Route path="calendar" element={<CalendarScreen />} />

        <Route path="budget" element={<BudgetScreen />} />
        <Route path="budget/accounts" element={<AccountsScreen />} />
        <Route path="budget/accounts/:sourceId" element={<AccountDetailScreen />} />
        <Route path="budget/cards" element={<CreditCardsScreen />} />
        <Route path="budget/cards/:cardId" element={<CreditCardDetailScreen />} />
        <Route path="budget/investments" element={<InvestmentsScreen />} />
        <Route path="budget/metrics" element={<BudgetMetricsScreen />} />
        <Route path="budget/activity" element={<ActivityScreen />} />

        <Route path="habits" element={<HabitsScreen />} />
        <Route path="habits/metrics" element={<HabitMetricsScreen />} />
        <Route path="habits/metrics/:date" element={<HabitDayScreen />} />
        <Route path="habits/:habitId" element={<HabitDetailScreen />} />

        <Route path="notes" element={<NotesScreen />} />
        <Route path="notes/:noteId" element={<NoteDetailScreen />} />
        <Route path="goals" element={<GoalsScreen />} />
        <Route path="pomodoro" element={<PomodoroListScreen />} />
        <Route path="pomodoro/:sessionId" element={<PomodoroScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
      </Routes>
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
