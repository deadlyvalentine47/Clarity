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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.ui.viewmodel.CreditCardViewModel
import kotlinx.coroutines.launch
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.time.YearMonth
import java.util.Calendar
import java.util.Date
import java.util.Locale

private val fmt0 = DecimalFormat("##,##,##0.##", DecimalFormatSymbols(Locale("en", "IN")))
private val monthNames = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CCSpendsScreen(
    viewModel: CreditCardViewModel = hiltViewModel(),
    onBack: () -> Unit = {}
) {
    val cardsWithDetails by viewModel.cardsWithDetails.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val currentYear = YearMonth.now().year
    var selectedMonths by remember { mutableStateOf(setOf(YearMonth.now().monthValue)) }
    var selectedYears by remember { mutableStateOf(setOf(currentYear)) }
    var allYears by remember { mutableStateOf(listOf(currentYear)) }

    LaunchedEffect(Unit) {
        val allTx = viewModel.getAllTransactions()
        val txYears = allTx.map {
            java.util.Calendar.getInstance().apply { timeInMillis = it.date }.get(java.util.Calendar.YEAR)
        }.toSet()
        allYears = (txYears + currentYear).sortedDescending().distinct()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("CC Spends") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        if (cardsWithDetails.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("No credit cards added yet", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    CCFilterRow(
                        selectedMonths = selectedMonths,
                        onMonthsChange = { selectedMonths = it },
                        selectedYears = selectedYears,
                        onYearsChange = { selectedYears = it },
                        allYears = allYears
                    )
                }
                items(cardsWithDetails, key = { it.card.id }) { cwd ->
                    ExpandableCCCard(cwd = cwd, viewModel = viewModel, selectedMonths = selectedMonths, selectedYears = selectedYears)
                }
            }
        }
    }
}

@Composable
private fun CCFilterRow(
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
                    Icon(if (monthExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, contentDescription = null)
                }
            )
            DropdownMenu(expanded = monthExpanded, onDismissRequest = { monthExpanded = false }) {
                Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                    TextButton(onClick = { onMonthsChange((1..12).toSet()) }) { Text("All") }
                    TextButton(onClick = { onMonthsChange(emptySet()) }) { Text("None") }
                }
                monthNames.forEachIndexed { index, name ->
                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(
                                    checked = (index + 1) in selectedMonths,
                                    onCheckedChange = { checked ->
                                        onMonthsChange(if (checked) selectedMonths + (index + 1) else selectedMonths - (index + 1))
                                    }
                                )
                                Text(name)
                            }
                        },
                        onClick = {
                            onMonthsChange(if ((index + 1) in selectedMonths) selectedMonths - (index + 1) else selectedMonths + (index + 1))
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
                    Icon(if (yearExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, contentDescription = null)
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
                                        onYearsChange(if (checked) selectedYears + year else selectedYears - year)
                                    }
                                )
                                Text(year.toString())
                            }
                        },
                        onClick = {
                            onYearsChange(if (year in selectedYears) selectedYears - year else selectedYears + year)
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun ExpandableCCCard(
    cwd: com.clarity.app.ui.viewmodel.CardWithDetails,
    viewModel: CreditCardViewModel,
    selectedMonths: Set<Int>,
    selectedYears: Set<Int>
) {
    var expanded by remember { mutableStateOf(false) }
    val allTransactions by viewModel.selectedCardTransactions.collectAsStateWithLifecycle()

    LaunchedEffect(cwd.card.id, expanded) {
        if (expanded) {
            viewModel.selectCard(cwd.card.id)
        }
    }

    val filteredTransactions = remember(allTransactions, selectedMonths, selectedYears) {
        allTransactions.filter { tx ->
            val cal = Calendar.getInstance().apply { timeInMillis = tx.date }
            val txMonth = cal.get(Calendar.MONTH) + 1
            val txYear = cal.get(Calendar.YEAR)
            txMonth in selectedMonths && txYear in selectedYears
        }
    }

    val filteredPurchases = filteredTransactions.filter { it.type == "Purchase" }.sumOf { it.amount }
    val filteredPayments = filteredTransactions.filter { it.type == "Payment" }.sumOf { it.amount }
    val filteredCredits = filteredTransactions.filter { it.type == "Credit" }.sumOf { it.amount }
    val filteredOutstanding = filteredPurchases - filteredPayments - filteredCredits

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
                    Text(cwd.card.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Limit: \u20B9${fmt0.format(cwd.card.creditLimit)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Filtered", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        "\u20B9${fmt0.format(filteredOutstanding)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (filteredOutstanding > 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                    )
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

                    if (filteredTransactions.isEmpty()) {
                        Text("No transactions for selected period", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } else {
                        filteredTransactions.sortedByDescending { it.date }.forEach { tx ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(tx.description.ifBlank { tx.type }, style = MaterialTheme.typography.bodyMedium)
                                    Text(
                                        "${tx.type} \u2022 ${SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(tx.date))}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Text(
                                    if (tx.type == "Purchase") "-\u20B9${fmt0.format(tx.amount)}" else "+\u20B9${fmt0.format(tx.amount)}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (tx.type == "Purchase") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
