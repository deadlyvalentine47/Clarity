package com.clarity.app.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.outlined.Note
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.PermanentNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.clarity.app.ui.screens.budget.BankScreen
import com.clarity.app.ui.screens.budget.BudgetMainScreen
import com.clarity.app.ui.screens.budget.ComingSoonScreen
import com.clarity.app.ui.screens.budget.CreditCardDetailScreen
import com.clarity.app.ui.screens.budget.CreditCardsScreen
import com.clarity.app.ui.screens.budget.IncomeScreen
import com.clarity.app.ui.screens.budget.InvestmentScreen
import com.clarity.app.ui.screens.budget.MetricsScreen
import com.clarity.app.ui.screens.budget.SourceDetailScreen
import com.clarity.app.ui.screens.budget.SpendingScreen
import com.clarity.app.ui.screens.calendar.CalendarScreen
import com.clarity.app.ui.screens.habits.HabitDetailScreen
import com.clarity.app.ui.screens.habits.HabitsScreen
import com.clarity.app.ui.screens.home.HomeScreen
import com.clarity.app.ui.screens.home.OnboardingScreen
import com.clarity.app.ui.screens.notes.GoalsScreen
import com.clarity.app.ui.screens.notes.NoteDetailNavigation
import com.clarity.app.ui.screens.notes.NotesScreen
import com.clarity.app.ui.screens.pomodoro.PomodoroScreen
import com.clarity.app.ui.screens.pomodoro.PomodoroSessionListScreen
import com.clarity.app.ui.screens.settings.SettingsScreen
import com.clarity.app.ui.screens.tasks.TasksScreen
import com.clarity.app.ui.viewmodel.HomeViewModel
import kotlinx.coroutines.launch

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    data object Home : Screen("home", "Home", Icons.Default.Home)
    data object Tasks : Screen("tasks", "Tasks", Icons.AutoMirrored.Filled.List)
    data object Calendar : Screen("calendar", "Calendar", Icons.Default.DateRange)
    data object Habits : Screen("habits", "Habits", Icons.Default.Notifications)
    data object Budget : Screen("budget", "Budget", Icons.Outlined.AccountBalance)
    data object Notes : Screen("notes", "Notes", Icons.AutoMirrored.Outlined.Note)
    data object NoteDetail : Screen("note_detail/{noteId}", "Note Detail", Icons.AutoMirrored.Outlined.Note)
    data object Goals : Screen("goals", "Goals", Icons.Outlined.Flag)
    data object Pomodoro : Screen("pomodoro", "Pomodoro", Icons.Outlined.Timer)
    data object PomodoroSession : Screen("pomodoro_session/{focusSessionId}", "Pomodoro Session", Icons.Outlined.Timer)
    data object Settings : Screen("settings", "Settings", Icons.Default.Settings)
    data object HabitDetail : Screen("habit_detail/{habitId}", "Habit Detail", Icons.Default.Notifications)
    data object BudgetBank : Screen("budget_bank", "Bank", Icons.Default.Home)
    data object BudgetIncome : Screen("budget_income", "Income", Icons.Default.Home)
    data object BudgetSpending : Screen("budget_spending", "Spending", Icons.Default.Home)
    data object BudgetCreditCards : Screen("budget_credit_cards", "Credit Cards", Icons.Default.Home)
    data object BudgetCreditCardDetail : Screen("budget_credit_card/{cardId}", "Card Detail", Icons.Default.Home)
    data object BudgetInvestments : Screen("budget_investments", "Investments", Icons.Default.Home)
    data object BudgetComingSoon : Screen("budget_coming_soon", "Coming Soon", Icons.Default.Home)
    data object BudgetSources : Screen("budget_sources", "Sources", Icons.Default.Home)
    data object BudgetMetrics : Screen("budget_metrics", "Metrics", Icons.Default.Home)
}

val drawerItems = listOf(
    Screen.Home,
    Screen.Tasks,
    Screen.Calendar,
    Screen.Budget,
    Screen.Habits,
    Screen.Notes,
    Screen.Goals,
    Screen.Pomodoro,
    Screen.Settings
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClarityNavHost() {
    val navController = rememberNavController()
    val viewModel: HomeViewModel = hiltViewModel()
    val username by viewModel.username.collectAsStateWithLifecycle()
    val isFirstLaunch by viewModel.isFirstLaunch.collectAsStateWithLifecycle()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val configuration = LocalConfiguration.current
    val tablet = configuration.screenWidthDp >= 600

    if (isFirstLaunch && username.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize()) {
            OnboardingScreen(
                onUsernameSet = { name -> viewModel.setUsername(name) }
            )
        }
    } else {
        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentDestination = navBackStackEntry?.destination

        val navigateTo: (String) -> Unit = { route ->
            navController.navigate(route) {
                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        }

        if (tablet) {
            PermanentNavigationDrawer(
                drawerContent = {
                    ModalDrawerSheet {
                        Box(modifier = Modifier.padding(24.dp)) {
                            Text(
                                text = "Clarity",
                                style = MaterialTheme.typography.headlineMedium
                            )
                        }
                        drawerItems.forEach { screen ->
                            NavigationDrawerItem(
                                icon = { Icon(screen.icon, contentDescription = screen.title) },
                                label = { Text(screen.title) },
                                selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                                onClick = { navigateTo(screen.route) },
                                colors = NavigationDrawerItemDefaults.colors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                                )
                            )
                        }
                    }
                }
            ) {
                NavHost(
                    navController = navController,
                    startDestination = Screen.Home.route
                ) {
                    composable(Screen.Home.route) {
                        HomeScreen(
                            onNavigateToTasks = { navController.navigate(Screen.Tasks.route) },
                            onNavigateToHabits = { navController.navigate(Screen.Habits.route) },
                            onNavigateToEvents = { navController.navigate(Screen.Calendar.route) }
                        )
                    }
                    composable(Screen.Tasks.route) { TasksScreen() }
                    composable(Screen.Calendar.route) { CalendarScreen() }
                    composable(Screen.Habits.route) {
                        HabitsScreen(onHabitClick = { habitId ->
                            navController.navigate("habit_detail/$habitId")
                        })
                    }
                    composable(Screen.HabitDetail.route) { backStackEntry ->
                        val habitId = backStackEntry.arguments?.getString("habitId")?.toLongOrNull() ?: 0L
                        HabitDetailScreen(habitId = habitId, onBack = { navController.popBackStack() })
                    }
                    composable(Screen.Budget.route) {
                        BudgetMainScreen(
                            onNavigateToBank = { navController.navigate(Screen.BudgetBank.route) },
                            onNavigateToCreditCards = { navController.navigate(Screen.BudgetCreditCards.route) },
                            onNavigateToInvestments = { navController.navigate(Screen.BudgetComingSoon.route) },
                            onNavigateToSources = { navController.navigate(Screen.BudgetSources.route) },
                            onNavigateToMetrics = { navController.navigate(Screen.BudgetMetrics.route) }
                        )
                    }
                    composable(Screen.BudgetBank.route) { BankScreen(onBack = { navController.popBackStack() }) }
                    composable(Screen.BudgetIncome.route) { IncomeScreen(onBack = { navController.popBackStack() }) }
                    composable(Screen.BudgetSpending.route) { SpendingScreen(onBack = { navController.popBackStack() }) }
                    composable(Screen.BudgetCreditCards.route) {
                        CreditCardsScreen(
                            onBack = { navController.popBackStack() },
                            onCardClick = { cardId -> navController.navigate("budget_credit_card/$cardId") }
                        )
                    }
                    composable(Screen.BudgetCreditCardDetail.route) { backStackEntry ->
                        val cardId = backStackEntry.arguments?.getString("cardId")?.toLongOrNull() ?: 0L
                        CreditCardDetailScreen(cardId = cardId, onBack = { navController.popBackStack() })
                    }
                    composable(Screen.BudgetInvestments.route) { InvestmentScreen(onBack = { navController.popBackStack() }) }
                    composable(Screen.BudgetComingSoon.route) { ComingSoonScreen(onBack = { navController.popBackStack() }) }
                    composable(Screen.BudgetSources.route) { SourceDetailScreen(onBack = { navController.popBackStack() }) }
                    composable(Screen.BudgetMetrics.route) { MetricsScreen(onBack = { navController.popBackStack() }) }
                    composable(Screen.Notes.route) {
                        NotesScreen(onNoteClick = { noteId ->
                            navController.navigate("note_detail/$noteId")
                        })
                    }
                    composable(Screen.NoteDetail.route) { backStackEntry ->
                        val noteId = backStackEntry.arguments?.getString("noteId")?.toLongOrNull() ?: 0L
                        NoteDetailNavigation(noteId = noteId, onBack = { navController.popBackStack() })
                    }
                    composable(Screen.Goals.route) { GoalsScreen() }
                    composable(Screen.Pomodoro.route) {
                        PomodoroSessionListScreen(onSessionClick = { sessionId ->
                            navController.navigate("pomodoro_session/$sessionId")
                        })
                    }
                    composable(Screen.PomodoroSession.route) { backStackEntry ->
                        val focusSessionId = backStackEntry.arguments?.getString("focusSessionId")?.toLongOrNull() ?: 0L
                        PomodoroScreen(focusSessionId = focusSessionId, onBack = { navController.popBackStack() })
                    }
                    composable(Screen.Settings.route) { SettingsScreen() }
                }
            }
        } else {
            ModalNavigationDrawer(
                drawerState = drawerState,
                drawerContent = {
                    ModalDrawerSheet {
                        Box(modifier = Modifier.padding(24.dp)) {
                            Text(
                                text = "Clarity",
                                style = MaterialTheme.typography.headlineMedium
                            )
                        }
                        drawerItems.forEach { screen ->
                            NavigationDrawerItem(
                                icon = { Icon(screen.icon, contentDescription = screen.title) },
                                label = { Text(screen.title) },
                                selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                                onClick = {
                                    navigateTo(screen.route)
                                    scope.launch { drawerState.close() }
                                },
                                colors = NavigationDrawerItemDefaults.colors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                                )
                            )
                        }
                    }
                }
            ) {
                val isDetailScreen = currentDestination?.route?.startsWith("pomodoro_session") == true ||
                        currentDestination?.route?.startsWith("note_detail") == true ||
                        currentDestination?.route?.startsWith("habit_detail") == true

                Scaffold(
                    topBar = {
                        if (!isDetailScreen) {
                            TopAppBar(
                                title = { Text("Clarity") },
                                navigationIcon = {
                                    IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Filled.List,
                                            contentDescription = "Menu"
                                        )
                                    }
                                },
                                actions = {
                                    IconButton(onClick = {
                                        navController.navigate(Screen.Home.route) {
                                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                            launchSingleTop = true
                                            restoreState = true
                                        }
                                    }) {
                                        Icon(
                                            imageVector = Icons.Default.Home,
                                            contentDescription = "Home"
                                        )
                                    }
                                },
                                colors = TopAppBarDefaults.topAppBarColors(
                                    containerColor = MaterialTheme.colorScheme.primaryContainer
                                )
                            )
                        }
                    }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = Screen.Home.route,
                        modifier = if (isDetailScreen) Modifier else Modifier.padding(innerPadding)
                    ) {
                        composable(Screen.Home.route) {
                            HomeScreen(
                                onNavigateToTasks = { navController.navigate(Screen.Tasks.route) },
                                onNavigateToHabits = { navController.navigate(Screen.Habits.route) },
                                onNavigateToEvents = { navController.navigate(Screen.Calendar.route) }
                            )
                        }
                        composable(Screen.Tasks.route) { TasksScreen() }
                        composable(Screen.Calendar.route) { CalendarScreen() }
                        composable(Screen.Habits.route) {
                            HabitsScreen(onHabitClick = { habitId ->
                                navController.navigate("habit_detail/$habitId")
                            })
                        }
                        composable(Screen.HabitDetail.route) { backStackEntry ->
                            val habitId = backStackEntry.arguments?.getString("habitId")?.toLongOrNull() ?: 0L
                            HabitDetailScreen(habitId = habitId, onBack = { navController.popBackStack() })
                        }
                        composable(Screen.Budget.route) {
                            BudgetMainScreen(
                                onNavigateToBank = { navController.navigate(Screen.BudgetBank.route) },
                                onNavigateToCreditCards = { navController.navigate(Screen.BudgetCreditCards.route) },
                                onNavigateToInvestments = { navController.navigate(Screen.BudgetComingSoon.route) },
                                onNavigateToSources = { navController.navigate(Screen.BudgetSources.route) },
                                onNavigateToMetrics = { navController.navigate(Screen.BudgetMetrics.route) }
                            )
                        }
                        composable(Screen.BudgetBank.route) { BankScreen(onBack = { navController.popBackStack() }) }
                        composable(Screen.BudgetIncome.route) { IncomeScreen(onBack = { navController.popBackStack() }) }
                        composable(Screen.BudgetSpending.route) { SpendingScreen(onBack = { navController.popBackStack() }) }
                        composable(Screen.BudgetCreditCards.route) {
                            CreditCardsScreen(
                                onBack = { navController.popBackStack() },
                                onCardClick = { cardId -> navController.navigate("budget_credit_card/$cardId") }
                            )
                        }
                        composable(Screen.BudgetCreditCardDetail.route) { backStackEntry ->
                            val cardId = backStackEntry.arguments?.getString("cardId")?.toLongOrNull() ?: 0L
                            CreditCardDetailScreen(cardId = cardId, onBack = { navController.popBackStack() })
                        }
                        composable(Screen.BudgetInvestments.route) { InvestmentScreen(onBack = { navController.popBackStack() }) }
                        composable(Screen.BudgetComingSoon.route) { ComingSoonScreen(onBack = { navController.popBackStack() }) }
                        composable(Screen.BudgetSources.route) { SourceDetailScreen(onBack = { navController.popBackStack() }) }
                        composable(Screen.BudgetMetrics.route) { MetricsScreen(onBack = { navController.popBackStack() }) }
                        composable(Screen.Notes.route) {
                            NotesScreen(onNoteClick = { noteId ->
                                navController.navigate("note_detail/$noteId")
                            })
                        }
                        composable(Screen.NoteDetail.route) { backStackEntry ->
                            val noteId = backStackEntry.arguments?.getString("noteId")?.toLongOrNull() ?: 0L
                            NoteDetailNavigation(noteId = noteId, onBack = { navController.popBackStack() })
                        }
                        composable(Screen.Goals.route) { GoalsScreen() }
                        composable(Screen.Pomodoro.route) {
                            PomodoroSessionListScreen(onSessionClick = { sessionId ->
                                navController.navigate("pomodoro_session/$sessionId")
                            })
                        }
                        composable(Screen.PomodoroSession.route) { backStackEntry ->
                            val focusSessionId = backStackEntry.arguments?.getString("focusSessionId")?.toLongOrNull() ?: 0L
                            PomodoroScreen(focusSessionId = focusSessionId, onBack = { navController.popBackStack() })
                        }
                        composable(Screen.Settings.route) { SettingsScreen() }
                    }
                }
            }
        }
    }
}
