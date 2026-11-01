import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { usePreferences } from './context/PreferencesContext'
import { markMissedDaysForAll } from './db/habits'
import OnboardingScreen from './screens/OnboardingScreen'
import HomeScreen from './screens/HomeScreen'
import TasksScreen from './screens/TasksScreen'
import CalendarScreen from './screens/CalendarScreen'
import BudgetScreen from './screens/BudgetScreen'
import AccountsScreen from './screens/budget/AccountsScreen'
import AccountDetailScreen from './screens/budget/AccountDetailScreen'
import CreditCardsScreen from './screens/budget/CreditCardsScreen'
import CreditCardDetailScreen from './screens/budget/CreditCardDetailScreen'
import InvestmentsScreen from './screens/budget/InvestmentsScreen'
import BudgetMetricsScreen from './screens/budget/MetricsScreen'
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

  // Same as the Android HabitViewModel init: fill in missing past days as
  // missed without overwriting explicit completions.
  useEffect(() => {
    void markMissedDaysForAll()
  }, [])

  if (firstLaunch) {
    return <OnboardingScreen />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeScreen />} />
        <Route path="tasks" element={<TasksScreen />} />
        <Route path="calendar" element={<CalendarScreen />} />

        <Route path="budget" element={<BudgetScreen />} />
        <Route path="budget/accounts" element={<AccountsScreen />} />
        <Route path="budget/accounts/:sourceId" element={<AccountDetailScreen />} />
        <Route path="budget/cards" element={<CreditCardsScreen />} />
        <Route path="budget/cards/:cardId" element={<CreditCardDetailScreen />} />
        <Route path="budget/investments" element={<InvestmentsScreen />} />
        <Route path="budget/metrics" element={<BudgetMetricsScreen />} />

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
  )
}
