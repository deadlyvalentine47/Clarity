package com.clarity.app.ui.screens.budget

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.SourceEntity
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.ui.viewmodel.BudgetMainViewModel
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.time.YearMonth
import java.util.Calendar
import java.util.Date
import java.util.Locale

private val fmt0 = DecimalFormat("##,##,##0.##", DecimalFormatSymbols(Locale("en", "IN")))
private val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BanksScreen(
    viewModel: BudgetMainViewModel = hiltViewModel(),
    onBack: () -> Unit = {}
) {
    val sources by viewModel.sources.collectAsStateWithLifecycle()
    val transactions by viewModel.transactions.collectAsStateWithLifecycle()

    val currentYear = YearMonth.now().year
    val allYears = remember(transactions) {
        val txYears = transactions.map {
            val cal = Calendar.getInstance().apply { timeInMillis = it.date }
            cal.get(Calendar.YEAR)
        }.toSet()
        (listOf(currentYear) + txYears).sortedDescending().distinct()
    }

    var selectedMonths by remember { mutableStateOf(setOf(YearMonth.now().monthValue)) }
    var selectedYears by remember { mutableStateOf(setOf(currentYear)) }

    val filteredTransactions = remember(transactions, selectedMonths, selectedYears) {
        transactions.filter { tx ->
            val cal = Calendar.getInstance().apply { timeInMillis = tx.date }
            val txMonth = cal.get(Calendar.MONTH) + 1
            val txYear = cal.get(Calendar.YEAR)
            txMonth in selectedMonths && txYear in selectedYears
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Banks") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        if (sources.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("No banks added yet", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    MultiSelectFilterRow(
                        selectedMonths = selectedMonths,
                        onMonthsChange = { selectedMonths = it },
                        selectedYears = selectedYears,
                        onYearsChange = { selectedYears = it },
                        allYears = allYears
                    )
                }

                items(sources, key = { it.id }) { source ->
                    val sourceTransactions = filteredTransactions.filter { it.source == source.name }
                    val credits = sourceTransactions.filter { it.type == "Income" }.sumOf { it.amount }
                    val spends = sourceTransactions.filter { it.type == "Expense" }.sumOf { it.amount }
                    ExpandableBankCard(
                        bankName = source.name,
                        balance = source.balance,
                        credits = credits,
                        spends = spends,
                        transactions = sourceTransactions
                    )
                }
            }
        }
    }
}

@Composable
private fun MultiSelectFilterRow(
    selectedMonths: Set<Int>,
    onMonthsChange: (Set<Int>) -> Unit,
    selectedYears: Set<Int>,
    onYearsChange: (Set<Int>) -> Unit,
    allYears: List<Int>
) {
    var monthExpanded by remember { mutableStateOf(false) }
    var yearExpanded by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box {
            FilterChip(
                selected = monthExpanded,
                onClick = { monthExpanded = true },
                label = {
                    Text(
                        if (selectedMonths.size == 12) "All Months"
                        else "${selectedMonths.size} Month${if (selectedMonths.size != 1) "s" else ""}"
                    )
                },
                trailingIcon = {
                    Icon(
                        if (monthExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = null
                    )
                }
            )
            DropdownMenu(expanded = monthExpanded, onDismissRequest = { monthExpanded = false }) {
                Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                    TextButton(onClick = { onMonthsChange((1..12).toSet()) }) { Text("All") }
                    TextButton(onClick = { onMonthsChange(emptySet()) }) { Text("None") }
                }
                months.forEachIndexed { index, name ->
                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(
                                    checked = (index + 1) in selectedMonths,
                                    onCheckedChange = { checked ->
                                        onMonthsChange(
                                            if (checked) selectedMonths + (index + 1)
                                            else selectedMonths - (index + 1)
                                        )
                                    }
                                )
                                Text(name)
                            }
                        },
                        onClick = {
                            onMonthsChange(
                                if ((index + 1) in selectedMonths) selectedMonths - (index + 1)
                                else selectedMonths + (index + 1)
                            )
                        }
                    )
                }
            }
        }

        Box {
            FilterChip(
                selected = yearExpanded,
                onClick = { yearExpanded = true },
                label = {
                    Text(
                        if (selectedYears.size == 1) selectedYears.first().toString()
                        else "${selectedYears.size} Year${if (selectedYears.size != 1) "s" else ""}"
                    )
                },
                trailingIcon = {
                    Icon(
                        if (yearExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = null
                    )
                }
            )
            DropdownMenu(expanded = yearExpanded, onDismissRequest = { yearExpanded = false }) {
                Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                    TextButton(onClick = { onYearsChange(allYears.toSet()) }) { Text("All") }
                    TextButton(onClick = { onYearsChange(emptySet()) }) { Text("None") }
                }
                allYears.forEach { year ->
                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(
                                    checked = year in selectedYears,
                                    onCheckedChange = { checked ->
                                        onYearsChange(
                                            if (checked) selectedYears + year
                                            else selectedYears - year
                                        )
                                    }
                                )
                                Text(year.toString())
                            }
                        },
                        onClick = {
                            onYearsChange(
                                if (year in selectedYears) selectedYears - year
                                else selectedYears + year
                            )
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun ExpandableBankCard(
    bankName: String,
    balance: Double,
    credits: Double,
    spends: Double,
    transactions: List<TransactionEntity>
) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded },
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(bankName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Balance: \u20B9${fmt0.format(balance)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Credits", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("\u20B9${fmt0.format(credits)}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Spends", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("\u20B9${fmt0.format(spends)}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
                Icon(
                    if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    contentDescription = if (expanded) "Collapse" else "Expand",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            AnimatedVisibility(visible = expanded) {
                Column {
                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(8.dp))

                    if (transactions.isEmpty()) {
                        Text("No transactions for selected period", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } else {
                        transactions.sortedByDescending { it.date }.forEach { tx ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(tx.description.ifBlank { tx.category }, style = MaterialTheme.typography.bodyMedium)
                                    Text(
                                        "${tx.category} \u2022 ${SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(tx.date))}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Text(
                                    if (tx.type == "Income") "+\u20B9${fmt0.format(tx.amount)}" else "-\u20B9${fmt0.format(tx.amount)}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (tx.type == "Income") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
