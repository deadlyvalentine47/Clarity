package com.clarity.app.ui.screens.budget

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.clarity.app.ui.viewmodel.MetricsData
import com.clarity.app.ui.viewmodel.MetricsViewModel
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private val fmt0 = DecimalFormat("##,##,##0", DecimalFormatSymbols(Locale("en", "IN")))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MetricsScreen(
    viewModel: MetricsViewModel = hiltViewModel(),
    onBack: () -> Unit = {}
) {
    var selectedYear by remember { mutableIntStateOf(YearMonth.now().year) }
    var selectedMonth by remember { mutableIntStateOf(YearMonth.now().monthValue) }
    var monthExpanded by remember { mutableStateOf(false) }
    var yearExpanded by remember { mutableStateOf(false) }

    val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    val years = (YearMonth.now().year - 10)..(YearMonth.now().year + 10)
    val ym = YearMonth.of(selectedYear, selectedMonth)

    val metrics by produceState<MetricsData?>(initialValue = null, selectedYear, selectedMonth) {
        value = viewModel.loadMetrics(selectedYear, selectedMonth)
    }

    var bankExpanded by remember { mutableStateOf(true) }
    var ccExpanded by remember { mutableStateOf(true) }
    var investmentsExpanded by remember { mutableStateOf(true) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 80.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ExposedDropdownMenuBox(expanded = monthExpanded, onExpandedChange = { monthExpanded = it }) {
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
                ExposedDropdownMenuBox(expanded = yearExpanded, onExpandedChange = { yearExpanded = it }) {
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
                Text(ym.format(DateTimeFormatter.ofPattern("MMM yyyy")), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
        }

        val data = metrics
        if (data == null) {
            item {
                Text("Loading...", modifier = Modifier.fillMaxWidth().padding(32.dp), textAlign = TextAlign.Center)
            }
        } else {

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable { bankExpanded = !bankExpanded },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Bank", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text(if (bankExpanded) "▲" else "▼", style = MaterialTheme.typography.titleMedium)
                        }
                        AnimatedVisibility(visible = bankExpanded, enter = expandVertically(), exit = shrinkVertically()) {
                            Column {
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                                    StatItem("Credits", "\u20B9${fmt0.format(data.income)}", MaterialTheme.colorScheme.primary)
                                    StatItem("Spending", "\u20B9${fmt0.format(data.expenses)}", MaterialTheme.colorScheme.error)
                                    StatItem("Net", "\u20B9${fmt0.format(data.net)}", if (data.net >= 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                                }
                                val allSources = (data.incomeBySource.map { it.first } + data.expensesBySource.map { it.first }).distinct().sorted()
                                if (allSources.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(16.dp))
                                    HorizontalDivider()
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("By Source", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                                        Text("Source", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1.2f))
                                        Text("Credits", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                                        Text("Spending", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                                    }
                                    HorizontalDivider()
                                    allSources.forEach { src ->
                                        val inc = data.incomeBySource.firstOrNull { it.first == src }?.second ?: 0.0
                                        val exp = data.expensesBySource.firstOrNull { it.first == src }?.second ?: 0.0
                                        if (inc > 0 || exp > 0) {
                                            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                                                Text(src, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1.2f))
                                                Text("\u20B9${fmt0.format(inc)}", style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                                                Text("\u20B9${fmt0.format(exp)}", style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                                            }
                                        }
                                    }
                                }
                                if (data.categorySpending.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(16.dp))
                                    HorizontalDivider()
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("By Category", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                                        Text("Category", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1.2f))
                                        Text("Spending", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                                    }
                                    HorizontalDivider()
                                    data.categorySpending.forEach { (cat, amt) ->
                                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                                            Text(cat, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1.2f))
                                            Text("\u20B9${fmt0.format(amt)}", style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable { ccExpanded = !ccExpanded },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Credit Cards", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text(if (ccExpanded) "▲" else "▼", style = MaterialTheme.typography.titleMedium)
                        }
                        AnimatedVisibility(visible = ccExpanded, enter = expandVertically(), exit = shrinkVertically()) {
                            Column {
                                Spacer(modifier = Modifier.height(12.dp))
                                Text("By Source", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                                    Text("Card", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1.2f))
                                    Text("Spends", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                                }
                                HorizontalDivider()
                                if (data.cardSpending.all { it.second == 0.0 }) {
                                    Text("No card spending this month", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 8.dp))
                                } else {
                                    data.cardSpending.filter { it.second > 0 }.forEach { (name, spends) ->
                                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                                            Text(name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1.2f))
                                            Text("\u20B9${fmt0.format(spends)}", style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable { investmentsExpanded = !investmentsExpanded },
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Investments", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text(if (investmentsExpanded) "▲" else "▼", style = MaterialTheme.typography.titleMedium)
                        }
                        AnimatedVisibility(visible = investmentsExpanded, enter = expandVertically(), exit = shrinkVertically()) {
                            Column {
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceEvenly
                                ) {
                                    StatItem("Value", "\u20B9${fmt0.format(data.totalCurrent)}", MaterialTheme.colorScheme.tertiary)
                                    StatItem("Invested", "\u20B9${fmt0.format(data.totalInvested)}", MaterialTheme.colorScheme.onSurfaceVariant)
                                    StatItem("P&L", "\u20B9${fmt0.format(data.profitLoss)}", if (data.profitLoss >= 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatItem(label: String, value: String, color: androidx.compose.ui.graphics.Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = color)
    }
}
