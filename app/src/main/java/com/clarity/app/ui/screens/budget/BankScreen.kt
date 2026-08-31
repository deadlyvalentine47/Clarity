package com.clarity.app.ui.screens.budget

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.IncomeViewModel
import com.clarity.app.ui.viewmodel.SpendingViewModel
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale

private val fmt0 = DecimalFormat("##,##,##0.##", DecimalFormatSymbols(Locale("en", "IN")))
private val dateFmt = SimpleDateFormat("MMM dd", Locale.getDefault())

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BankScreen(
    incomeViewModel: IncomeViewModel = hiltViewModel(),
    spendingViewModel: SpendingViewModel = hiltViewModel(),
    onBack: () -> Unit = {}
) {
    val incomeTransactions by incomeViewModel.incomeTransactions.collectAsStateWithLifecycle()
    val expenseTransactions by spendingViewModel.expenseTransactions.collectAsStateWithLifecycle()
    val sources by incomeViewModel.sources.collectAsStateWithLifecycle()
    val categories by incomeViewModel.categories.collectAsStateWithLifecycle()
    val creditCards by spendingViewModel.creditCards.collectAsStateWithLifecycle()

    var selectedYear by remember { mutableIntStateOf(YearMonth.now().year) }
    var selectedMonth by remember { mutableIntStateOf(YearMonth.now().monthValue) }
    var monthExpanded by remember { mutableStateOf(false) }
    var yearExpanded by remember { mutableStateOf(false) }
    var creditsExpanded by remember { mutableStateOf(true) }
    var spendingExpanded by remember { mutableStateOf(true) }
    var showManagementDialog by remember { mutableStateOf(false) }
    var showAddIncomeDialog by remember { mutableStateOf(false) }
    var showAddExpenseDialog by remember { mutableStateOf(false) }
    var fabExpanded by remember { mutableStateOf(false) }
    var incomeToDelete by remember { mutableStateOf<com.clarity.app.data.local.database.TransactionEntity?>(null) }
    var expenseToDelete by remember { mutableStateOf<com.clarity.app.data.local.database.TransactionEntity?>(null) }
    var showFilterDialog by remember { mutableStateOf(false) }
    var filterSources by remember { mutableStateOf<Set<String>>(emptySet()) }
    var filterCategories by remember { mutableStateOf<Set<String>>(emptySet()) }
    var selectedFilterTab by remember { mutableIntStateOf(0) }

    val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    val years = (YearMonth.now().year - 10)..(YearMonth.now().year + 10)

    val ym = YearMonth.of(selectedYear, selectedMonth)
    val ymIncome = remember(selectedYear, selectedMonth, incomeTransactions, filterSources) {
        incomeTransactions.filter {
            val cal = java.util.Calendar.getInstance()
            cal.timeInMillis = it.date
            val txYM = YearMonth.of(cal.get(java.util.Calendar.YEAR), cal.get(java.util.Calendar.MONTH) + 1)
            txYM == ym && (filterSources.isEmpty() || it.source in filterSources)
        }
    }
    val ymExpenses = remember(selectedYear, selectedMonth, expenseTransactions, filterSources, filterCategories) {
        expenseTransactions.filter {
            val cal = java.util.Calendar.getInstance()
            cal.timeInMillis = it.date
            val txYM = YearMonth.of(cal.get(java.util.Calendar.YEAR), cal.get(java.util.Calendar.MONTH) + 1)
            txYM == ym && (filterSources.isEmpty() || it.source in filterSources) &&
                    (filterCategories.isEmpty() || it.category in filterCategories)
        }
    }
    val totalIncome = remember(ymIncome) { ymIncome.sumOf { it.amount } }
    val totalExpenses = remember(ymExpenses) { ymExpenses.sumOf { it.amount } }

    Scaffold(
        floatingActionButton = {
            Column(horizontalAlignment = Alignment.End) {
                AnimatedVisibility(visible = fabExpanded, enter = expandVertically(), exit = shrinkVertically()) {
                    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SmallFloatingActionButton(onClick = { fabExpanded = false; showAddExpenseDialog = true }) {
                            Text("Spend", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                        }
                        SmallFloatingActionButton(onClick = { fabExpanded = false; showAddIncomeDialog = true }) {
                            Text("Credit", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                FloatingActionButton(onClick = { fabExpanded = !fabExpanded }) {
                    Text(if (fabExpanded) "✕" else "+", style = MaterialTheme.typography.titleLarge)
                }
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ExposedDropdownMenuBox(
                        expanded = monthExpanded,
                        onExpandedChange = { monthExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = months[selectedMonth - 1],
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier.widthIn(min = 80.dp, max = 100.dp).menuAnchor(MenuAnchorType.PrimaryNotEditable),
                            textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center),
                            singleLine = true
                        )
                        ExposedDropdownMenu(expanded = monthExpanded, onDismissRequest = { monthExpanded = false }) {
                            months.forEachIndexed { index, month ->
                                DropdownMenuItem(
                                    text = { Text(month) },
                                    onClick = { selectedMonth = index + 1; monthExpanded = false }
                                )
                            }
                        }
                    }

                    ExposedDropdownMenuBox(
                        expanded = yearExpanded,
                        onExpandedChange = { yearExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = selectedYear.toString(),
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier.widthIn(min = 80.dp, max = 100.dp).menuAnchor(MenuAnchorType.PrimaryNotEditable),
                            textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center),
                            singleLine = true
                        )
                        ExposedDropdownMenu(expanded = yearExpanded, onDismissRequest = { yearExpanded = false }) {
                            years.forEach { year ->
                                DropdownMenuItem(
                                    text = { Text(year.toString()) },
                                    onClick = { selectedYear = year; yearExpanded = false }
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    IconButton(onClick = { showFilterDialog = true }) {
                        Icon(Icons.Default.FilterList, contentDescription = "Filter")
                    }

                    IconButton(onClick = { showManagementDialog = true }) {
                        Icon(Icons.Default.Settings, contentDescription = "Manage Sources & Categories")
                    }
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth().clickable { creditsExpanded = !creditsExpanded },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Credits ${ym.format(DateTimeFormatter.ofPattern("MMM yyyy"))}", style = MaterialTheme.typography.labelLarge)
                                Text("\u20B9${fmt0.format(totalIncome)}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                            }
                            Text(if (creditsExpanded) "▲" else "▼", style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
            }

            item {
                AnimatedVisibility(visible = creditsExpanded, enter = expandVertically(), exit = shrinkVertically()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (ymIncome.isEmpty()) {
                            Text("No credits recorded", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 8.dp))
                        } else {
                            ymIncome.forEach { tx ->
                                TransactionRow(
                                    label = tx.description.ifBlank { tx.source },
                                    subtitle = tx.source,
                                    date = dateFmt.format(Date(tx.date)),
                                    amount = tx.amount,
                                    isIncome = true,
                                    onDelete = { incomeToDelete = tx }
                                )
                            }
                        }
                    }
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth().clickable { spendingExpanded = !spendingExpanded },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Spending ${ym.format(DateTimeFormatter.ofPattern("MMM yyyy"))}", style = MaterialTheme.typography.labelLarge)
                                Text("\u20B9${fmt0.format(totalExpenses)}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                            }
                            Text(if (spendingExpanded) "▲" else "▼", style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
            }

            item {
                AnimatedVisibility(visible = spendingExpanded, enter = expandVertically(), exit = shrinkVertically()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (ymExpenses.isEmpty()) {
                            Text("No spending recorded", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 8.dp))
                        } else {
                            ymExpenses.forEach { tx ->
                                TransactionRow(
                                    label = tx.description.ifBlank { tx.category },
                                    subtitle = tx.category,
                                    date = dateFmt.format(Date(tx.date)),
                                    amount = tx.amount,
                                    isIncome = false,
                                    onDelete = { expenseToDelete = tx }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddIncomeDialog) {
        AddIncomeDialog(
            sources = sources.map { it.name },
            categories = categories.map { it.name },
            onDismiss = { showAddIncomeDialog = false },
            onConfirm = { amount, source, category, description ->
                incomeViewModel.addIncome(amount, source, category, description)
                showAddIncomeDialog = false
            }
        )
    }

    if (showAddExpenseDialog) {
        AddExpenseDialog(
            categories = categories.map { it.name },
            sources = sources.map { it.name },
            creditCardNames = creditCards.map { it.name },
            onDismiss = { showAddExpenseDialog = false },
            onConfirm = { amount, category, source, description, isBillPayment, cardName ->
                spendingViewModel.addExpense(amount, category, source, description, isBillPayment, cardName)
                showAddExpenseDialog = false
            }
        )
    }

    incomeToDelete?.let { tx ->
        DeleteConfirmationDialog(
            title = "Delete Credit",
            message = "Are you sure?",
            onConfirm = { incomeViewModel.deleteIncome(tx); incomeToDelete = null },
            onDismiss = { incomeToDelete = null }
        )
    }

    expenseToDelete?.let { tx ->
        DeleteConfirmationDialog(
            title = "Delete Expense",
            message = "Are you sure?",
            onConfirm = { spendingViewModel.deleteExpense(tx); expenseToDelete = null },
            onDismiss = { expenseToDelete = null }
        )
    }

    if (showFilterDialog) {
        Dialog(onDismissRequest = { showFilterDialog = false }) {
            Surface(
                shape = MaterialTheme.shapes.large,
                tonalElevation = 6.dp,
                modifier = Modifier.widthIn(min = 300.dp, max = 400.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Filter", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = {
                                filterSources = emptySet()
                                filterCategories = emptySet()
                            }) { Text("Clear") }
                            TextButton(onClick = { showFilterDialog = false }) { Text("Done") }
                        }
                    }
                    HorizontalDivider()
                    Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                        Column(
                            modifier = Modifier
                                .width(120.dp)
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                                .padding(vertical = 8.dp)
                        ) {
                            TextButton(
                                onClick = { selectedFilterTab = 0 },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    "Sources",
                                    fontWeight = if (selectedFilterTab == 0) FontWeight.Bold else FontWeight.Normal,
                                    color = if (selectedFilterTab == 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            TextButton(
                                onClick = { selectedFilterTab = 1 },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    "Categories",
                                    fontWeight = if (selectedFilterTab == 1) FontWeight.Bold else FontWeight.Normal,
                                    color = if (selectedFilterTab == 1) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .verticalScroll(rememberScrollState())
                                .padding(8.dp)
                        ) {
                            if (selectedFilterTab == 0) {
                                Column {
                                    if (sources.isEmpty()) {
                                        Text("No sources", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    } else {
                                        sources.forEach { src ->
                                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                                                Checkbox(checked = filterSources.contains(src.name), onCheckedChange = { checked ->
                                                    filterSources = if (checked) filterSources + src.name else filterSources - src.name
                                                })
                                                Text(src.name, style = MaterialTheme.typography.bodyMedium)
                                            }
                                        }
                                    }
                                }
                            } else {
                                Column {
                                    if (categories.isEmpty()) {
                                        Text("No categories", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    } else {
                                        categories.forEach { cat ->
                                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                                                Checkbox(checked = filterCategories.contains(cat.name), onCheckedChange = { checked ->
                                                    filterCategories = if (checked) filterCategories + cat.name else filterCategories - cat.name
                                                })
                                                Text(cat.name, style = MaterialTheme.typography.bodyMedium)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showManagementDialog) {
        ManageSourcesCategoriesDialog(
            sources = sources.map { it.name },
            categories = categories.map { it.name },
            onAddSource = { incomeViewModel.addSource(it) },
            onDeleteSource = { incomeViewModel.deleteSource(it) },
            onAddCategory = { incomeViewModel.addCategory(it) },
            onDeleteCategory = { incomeViewModel.deleteCategory(it) },
            onDismiss = { showManagementDialog = false }
        )
    }
}

@Composable
private fun TransactionRow(
    label: String,
    subtitle: String,
    date: String,
    amount: Double,
    isIncome: Boolean,
    onDelete: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.bodyMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(date, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "${if (isIncome) "+" else "-"}\u20B9${fmt0.format(amount)}",
                    style = MaterialTheme.typography.titleSmall,
                    color = if (isIncome) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                )
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Close, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error, modifier = Modifier.padding(start = 4.dp))
                }
            }
        }
    }
}
