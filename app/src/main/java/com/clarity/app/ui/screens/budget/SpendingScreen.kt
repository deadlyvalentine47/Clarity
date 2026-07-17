package com.clarity.app.ui.screens.budget

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.SpendingViewModel
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale

private val indianFormat = DecimalFormat("##,##,##0.00", DecimalFormatSymbols(Locale("en", "IN")))
private val indianFormatNoDecimal = DecimalFormat("##,##,##0", DecimalFormatSymbols(Locale("en", "IN")))
private fun fmt(amount: Double): String = indianFormat.format(amount)
private fun fmt0(amount: Double): String = indianFormatNoDecimal.format(amount)
private val monthFmt = DateTimeFormatter.ofPattern("MMM yyyy")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpendingScreen(
    viewModel: SpendingViewModel = hiltViewModel(),
    onBack: () -> Unit = {}
) {
    val expenseTransactions by viewModel.expenseTransactions.collectAsStateWithLifecycle()
    val categories by viewModel.categories.collectAsStateWithLifecycle()
    val sources by viewModel.sources.collectAsStateWithLifecycle()
    val creditCards by viewModel.creditCards.collectAsStateWithLifecycle()
    var showAddDialog by remember { mutableStateOf(false) }
    var showManagementDialog by remember { mutableStateOf(false) }
    var selectedYM by remember { mutableStateOf(YearMonth.now()) }

    val monthExpenses = remember(selectedYM) { viewModel.getMonthExpenses(selectedYM.year, selectedYM.monthValue) }
    val dailyExpenses = remember(selectedYM) { viewModel.getDailyExpenses(selectedYM.year, selectedYM.monthValue) }
    val categorySpending = remember(selectedYM) { viewModel.getCategorySpending(selectedYM.year, selectedYM.monthValue) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Expense")
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            item {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    MonthSelectorRow(selectedYM, onPrev = { selectedYM = selectedYM.minusMonths(1) }, onNext = { selectedYM = selectedYM.plusMonths(1) }, modifier = Modifier.weight(1f))
                    IconButton(onClick = { showManagementDialog = true }) {
                        Icon(Icons.Default.Settings, contentDescription = "Manage Sources & Categories")
                    }
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Text("Spending ${selectedYM.format(monthFmt)}", style = MaterialTheme.typography.labelLarge)
                        Text("\u20B9${fmt(monthExpenses)}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (dailyExpenses.isNotEmpty()) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("Daily Spending", style = MaterialTheme.typography.titleMedium)
                            Spacer(modifier = Modifier.height(8.dp))
                            val maxVal = dailyExpenses.maxOfOrNull { it.second } ?: 1.0
                            Row(
                                modifier = Modifier.fillMaxWidth().height(50.dp),
                                horizontalArrangement = Arrangement.spacedBy(2.dp),
                                verticalAlignment = Alignment.Bottom
                            ) {
                                dailyExpenses.forEach { (_, value) ->
                                    val fraction = (value / maxVal).toFloat().coerceIn(0.01f, 1f)
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height((fraction * 46).dp)
                                            .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                                            .background(MaterialTheme.colorScheme.error.copy(alpha = 0.6f))
                                    )
                                }
                            }
                        }
                    }
                }
            }

            if (categorySpending.isNotEmpty()) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("Spending by Category", style = MaterialTheme.typography.titleMedium)
                            Spacer(modifier = Modifier.height(8.dp))
                            val maxVal = categorySpending.maxOfOrNull { it.second } ?: 1.0
                            categorySpending.forEach { (category, amount) ->
                                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text(category, style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(90.dp))
                                    Box(
                                        modifier = Modifier.weight(1f).height(16.dp).clip(RoundedCornerShape(4.dp))
                                            .background(MaterialTheme.colorScheme.errorContainer)
                                    ) {
                                        Box(
                                            modifier = Modifier.fillMaxWidth((amount / maxVal).toFloat().coerceIn(0f, 1f)).height(16.dp)
                                                .clip(RoundedCornerShape(4.dp)).background(MaterialTheme.colorScheme.error)
                                        )
                                    }
                                    Text("\u20B9${fmt0(amount)}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(start = 8.dp))
                                }
                            }
                        }
                    }
                }
            }

            if (expenseTransactions.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("No expenses recorded yet", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                item { Text("All Expenses", style = MaterialTheme.typography.titleMedium) }
                items(expenseTransactions, key = { it.id }) { transaction ->
                    ExpenseItem(transaction, onDelete = { viewModel.deleteExpense(transaction) })
                }
            }
        }
    }

    if (showAddDialog) {
        AddExpenseDialog(
            categories = categories.map { it.name },
            sources = sources.map { it.name },
            creditCardNames = creditCards.map { it.name },
            onDismiss = { showAddDialog = false },
            onConfirm = { amount, category, source, description, isBillPayment, cardName ->
                viewModel.addExpense(amount, category, source, description, isBillPayment, cardName)
                showAddDialog = false
            }
        )
    }

    if (showManagementDialog) {
        ManageSourcesCategoriesDialog(
            sources = sources.map { it.name },
            categories = categories.map { it.name },
            onAddSource = { viewModel.addSource(it) },
            onDeleteSource = { viewModel.deleteSource(it) },
            onAddCategory = { viewModel.addCategory(it) },
            onDeleteCategory = { viewModel.deleteCategory(it) },
            onDismiss = { showManagementDialog = false }
        )
    }
}

@Composable
private fun ExpenseItem(transaction: TransactionEntity, onDelete: () -> Unit) {
    var showDeleteDialog by remember { mutableStateOf(false) }
    if (showDeleteDialog) {
        DeleteConfirmationDialog(
            title = "Delete Expense",
            message = "Are you sure?",
            onConfirm = { onDelete(); showDeleteDialog = false },
            onDismiss = { showDeleteDialog = false }
        )
    }
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(transaction.description.ifBlank { transaction.category }, style = MaterialTheme.typography.bodyLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(transaction.category, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (transaction.source.isNotBlank()) Text("| ${transaction.source}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(transaction.date)), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("-\u20B9${fmt(transaction.amount)}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.error)
                IconButton(onClick = { showDeleteDialog = true }) {
                    Icon(Icons.Default.Close, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddExpenseDialog(
    categories: List<String>,
    sources: List<String>,
    creditCardNames: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (Double, String, String, String, Boolean, String?) -> Unit
) {
    var amount by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var source by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var isCreditBillPayment by remember { mutableStateOf(false) }
    var selectedCardName by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Expense") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.verticalScroll(rememberScrollState())) {
                OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Amount *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth(), singleLine = true)

                if (creditCardNames.isNotEmpty()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = isCreditBillPayment, onCheckedChange = { isCreditBillPayment = it })
                        Text("Credit Card Bill Payment", style = MaterialTheme.typography.bodyMedium)
                    }
                }

                if (isCreditBillPayment && creditCardNames.isNotEmpty()) {
                    Column {
                        Text("Select Card *", style = MaterialTheme.typography.bodyMedium)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            creditCardNames.forEach { cardName ->
                                FilterChip(selected = selectedCardName == cardName, onClick = { selectedCardName = cardName }, label = { Text(cardName) })
                            }
                        }
                    }
                } else {
                    Column {
                        Text("Category *", style = MaterialTheme.typography.bodyMedium)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            categories.forEach { cat ->
                                FilterChip(selected = category == cat, onClick = { category = cat }, label = { Text(cat) })
                            }
                        }
                    }
                }

                Column {
                    Text("Bank Account *", style = MaterialTheme.typography.bodyMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        sources.forEach { src ->
                            FilterChip(selected = source == src, onClick = { source = src }, label = { Text(src) })
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val amt = amount.toDoubleOrNull()
                    if (amt != null && amt > 0 && source.isNotBlank()) {
                        val validCategory = if (isCreditBillPayment) selectedCardName != null else category.isNotBlank()
                        if (validCategory) {
                            onConfirm(amt, category, source, description.trim(), isCreditBillPayment, selectedCardName)
                        }
                    }
                },
                enabled = (amount.toDoubleOrNull() ?: 0.0) > 0 && source.isNotBlank() &&
                        (if (isCreditBillPayment) selectedCardName != null else category.isNotBlank())
            ) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
