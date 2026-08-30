package com.clarity.app.ui.screens.budget

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.IncomeViewModel
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
fun IncomeScreen(
    viewModel: IncomeViewModel = hiltViewModel(),
    onBack: () -> Unit = {}
) {
    val incomeTransactions by viewModel.incomeTransactions.collectAsStateWithLifecycle()
    val sources by viewModel.sources.collectAsStateWithLifecycle()
    val categories by viewModel.categories.collectAsStateWithLifecycle()
    var showAddDialog by remember { mutableStateOf(false) }
    var showManagementDialog by remember { mutableStateOf(false) }
    var selectedYM by remember { mutableStateOf(YearMonth.now()) }

    val monthIncome = remember(selectedYM) { viewModel.getMonthIncome(selectedYM.year, selectedYM.monthValue) }
    val dailyIncome = remember(selectedYM) { viewModel.getDailyIncome(selectedYM.year, selectedYM.monthValue) }
    val incomeBySource = remember(selectedYM) { viewModel.getIncomeBySource(selectedYM.year, selectedYM.monthValue) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Income")
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
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Text("Credits ${selectedYM.format(monthFmt)}", style = MaterialTheme.typography.labelLarge)
                        Text("\u20B9${fmt(monthIncome)}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (dailyIncome.isNotEmpty()) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("Daily Credits", style = MaterialTheme.typography.titleMedium)
                            Spacer(modifier = Modifier.height(8.dp))
                            val maxVal = dailyIncome.maxOfOrNull { it.second } ?: 1.0
                            Row(
                                modifier = Modifier.fillMaxWidth().height(50.dp),
                                horizontalArrangement = Arrangement.spacedBy(2.dp),
                                verticalAlignment = Alignment.Bottom
                            ) {
                                dailyIncome.forEach { (_, value) ->
                                    val fraction = (value / maxVal).toFloat().coerceIn(0.01f, 1f)
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height((fraction * 46).dp)
                                            .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.6f))
                                    )
                                }
                            }
                        }
                    }
                }
            }

            if (incomeBySource.isNotEmpty()) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("Credits by Bank", style = MaterialTheme.typography.titleMedium)
                            Spacer(modifier = Modifier.height(8.dp))
                            val maxVal = incomeBySource.maxOfOrNull { it.second } ?: 1.0
                            incomeBySource.forEach { (source, amount) ->
                                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text(source, style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(80.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Box(
                                        modifier = Modifier.weight(1f).height(16.dp).clip(RoundedCornerShape(4.dp))
                                            .background(MaterialTheme.colorScheme.primaryContainer)
                                    ) {
                                        Box(
                                            modifier = Modifier.fillMaxWidth((amount / maxVal).toFloat().coerceIn(0f, 1f)).height(16.dp)
                                                .clip(RoundedCornerShape(4.dp)).background(MaterialTheme.colorScheme.primary)
                                        )
                                    }
                                    Text("\u20B9${fmt0(amount)}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(start = 8.dp))
                                }
                            }
                        }
                    }
                }
            }

            if (incomeTransactions.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("No credits recorded yet", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                item { Text("All Credits", style = MaterialTheme.typography.titleMedium) }
                items(incomeTransactions, key = { it.id }) { transaction ->
                    IncomeItem(transaction, onDelete = { viewModel.deleteIncome(transaction) })
                }
            }
        }
    }

    if (showAddDialog) {
        AddIncomeDialog(
            sources = sources.map { it.name },
            categories = categories.map { it.name },
            onDismiss = { showAddDialog = false },
            onConfirm = { amount, source, category, description ->
                viewModel.addIncome(amount, source, category, description)
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
fun MonthSelectorRow(ym: YearMonth, onPrev: () -> Unit, onNext: () -> Unit, modifier: Modifier = Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onPrev) { Icon(Icons.Default.ChevronLeft, contentDescription = "Previous") }
        Text(ym.format(monthFmt), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.width(160.dp))
        IconButton(onClick = onNext) { Icon(Icons.Default.ChevronRight, contentDescription = "Next") }
    }
}

@Composable
private fun IncomeItem(transaction: TransactionEntity, onDelete: () -> Unit) {
    var showDeleteDialog by remember { mutableStateOf(false) }
    if (showDeleteDialog) {
        DeleteConfirmationDialog(
            title = "Delete Credit",
            message = "Are you sure?",
            onConfirm = { onDelete(); showDeleteDialog = false },
            onDismiss = { showDeleteDialog = false }
        )
    }
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(transaction.description.ifBlank { transaction.source }, style = MaterialTheme.typography.bodyLarge)
                Text(transaction.source, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(transaction.date)), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("+\u20B9${fmt(transaction.amount)}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                IconButton(onClick = { showDeleteDialog = true }) {
                    Icon(Icons.Default.Close, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddIncomeDialog(
    sources: List<String>,
    categories: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (Double, String, String, String) -> Unit
) {
    var amount by remember { mutableStateOf("") }
    var source by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Credit") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.verticalScroll(rememberScrollState())) {
                OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Amount *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Column {
                    Text("Category *", style = MaterialTheme.typography.bodyMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                        categories.forEach { cat ->
                            FilterChip(selected = category == cat, onClick = { category = cat }, label = { Text(cat) })
                        }
                    }
                }
                Column {
                    Text("Bank Account *", style = MaterialTheme.typography.bodyMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
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
                    if (amt != null && amt > 0 && source.isNotBlank() && category.isNotBlank()) {
                        onConfirm(amt, source, category, description.trim())
                    }
                },
                enabled = amount.toDoubleOrNull() != null && (amount.toDoubleOrNull() ?: 0.0) > 0 && source.isNotBlank() && category.isNotBlank()
            ) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
