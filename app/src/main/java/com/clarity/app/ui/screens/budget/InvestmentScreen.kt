package com.clarity.app.ui.screens.budget

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
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
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.InvestmentEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.InvestmentViewModel
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale

private val fmt0 = DecimalFormat("##,##,##0", DecimalFormatSymbols(Locale("en", "IN")))
private val fmt2 = DecimalFormat("##,##,##0.00", DecimalFormatSymbols(Locale("en", "IN")))
private val monthFmt = DateTimeFormatter.ofPattern("MMM yyyy")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvestmentScreen(
    viewModel: InvestmentViewModel = hiltViewModel(),
    onBack: () -> Unit = {}
) {
    val investments by viewModel.investments.collectAsStateWithLifecycle()
    val summary by viewModel.summary.collectAsStateWithLifecycle()
    val typeAllocation by viewModel.typeAllocation.collectAsStateWithLifecycle()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingInvestment by remember { mutableStateOf<InvestmentEntity?>(null) }
    var investmentToDelete by remember { mutableStateOf<InvestmentEntity?>(null) }
    var selectedYM by remember { mutableStateOf(YearMonth.now()) }

    val filteredInvestments = investments.filter { inv ->
        val cal = java.util.Calendar.getInstance()
        cal.timeInMillis = inv.purchaseDate
        val invYM = YearMonth.of(cal.get(java.util.Calendar.YEAR), cal.get(java.util.Calendar.MONTH) + 1)
        invYM == selectedYM
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Investment")
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Text("Investment Summary", style = MaterialTheme.typography.labelLarge)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text("Invested", style = MaterialTheme.typography.bodySmall)
                                Text("\u20B9${fmt0.format(summary.totalInvested)}", style = MaterialTheme.typography.titleMedium)
                            }
                            Column {
                                Text("Current Value", style = MaterialTheme.typography.bodySmall)
                                Text("\u20B9${fmt0.format(summary.totalCurrentValue)}", style = MaterialTheme.typography.titleMedium)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("P&L", style = MaterialTheme.typography.bodySmall)
                                Text(
                                    "\u20B9${fmt0.format(summary.totalProfitLoss)} (${fmt2.format(summary.profitLossPercent)}%)",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = if (summary.totalProfitLoss >= 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                }
            }

            if (typeAllocation.isNotEmpty()) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("Allocation by Type", style = MaterialTheme.typography.titleMedium)
                            Spacer(modifier = Modifier.height(8.dp))
                            val maxVal = typeAllocation.maxOfOrNull { it.totalCurrentValue } ?: 1.0
                            typeAllocation.forEach { alloc ->
                                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text(alloc.type, style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(90.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Box(modifier = Modifier.weight(1f).height(16.dp).clip(RoundedCornerShape(4.dp)).background(MaterialTheme.colorScheme.secondaryContainer)) {
                                        Box(modifier = Modifier.fillMaxWidth((alloc.totalCurrentValue / maxVal).toFloat().coerceIn(0f, 1f)).height(16.dp).clip(RoundedCornerShape(4.dp)).background(MaterialTheme.colorScheme.secondary))
                                    }
                                    Text("\u20B9${fmt0.format(alloc.totalCurrentValue)}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(start = 8.dp))
                                }
                            }
                        }
                    }
                }
            }

            item { MonthSelectorRow(selectedYM, onPrev = { selectedYM = selectedYM.minusMonths(1) }, onNext = { selectedYM = selectedYM.plusMonths(1) }) }

            if (filteredInvestments.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("No investments this month", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                item { Text("All Investments", style = MaterialTheme.typography.titleMedium) }
                items(filteredInvestments, key = { it.id }) { investment ->
                    InvestmentCard(
                        investment = investment,
                        onEdit = { editingInvestment = investment },
                        onDelete = { investmentToDelete = investment }
                    )
                }
            }
        }
    }

    if (showAddDialog || editingInvestment != null) {
        AddEditInvestmentDialog(
            initial = editingInvestment,
            types = viewModel.investmentTypes,
            onDismiss = { showAddDialog = false; editingInvestment = null },
            onConfirm = { name, type, units, purchasePrice, currentPrice, purchaseDate, notes ->
                if (editingInvestment != null) {
                    viewModel.updateInvestment(editingInvestment!!.copy(name = name, type = type, units = units, purchasePrice = purchasePrice, currentPrice = currentPrice, purchaseDate = purchaseDate, notes = notes))
                } else {
                    viewModel.addInvestment(name, type, units, purchasePrice, currentPrice, purchaseDate, notes)
                }
                showAddDialog = false; editingInvestment = null
            }
        )
    }

    investmentToDelete?.let { inv ->
        DeleteConfirmationDialog(
            title = "Delete Investment",
            message = "Delete \"${inv.name}\"?",
            onConfirm = { viewModel.deleteInvestment(inv); investmentToDelete = null },
            onDismiss = { investmentToDelete = null }
        )
    }
}

@Composable
private fun InvestmentCard(investment: InvestmentEntity, onEdit: () -> Unit, onDelete: () -> Unit) {
    val invested = investment.units * investment.purchasePrice
    val currentValue = investment.units * investment.currentPrice
    val profit = currentValue - invested
    val profitPercent = if (invested > 0) (profit / invested) * 100 else 0.0

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(investment.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(investment.type, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                        Text("${investment.units} units", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(SimpleDateFormat("MMM yyyy", Locale.getDefault()).format(Date(investment.purchaseDate)), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Row {
                    IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, contentDescription = "Edit", tint = MaterialTheme.colorScheme.primary) }
                    IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error) }
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Invested", style = MaterialTheme.typography.bodySmall)
                    Text("\u20B9${fmt0.format(invested)}", style = MaterialTheme.typography.bodyMedium)
                }
                Column {
                    Text("Current", style = MaterialTheme.typography.bodySmall)
                    Text("\u20B9${fmt0.format(currentValue)}", style = MaterialTheme.typography.bodyMedium)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("P&L", style = MaterialTheme.typography.bodySmall)
                    Text(
                        "\u20B9${fmt0.format(profit)} (${fmt2.format(profitPercent)}%)",
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (profit >= 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                    )
                }
            }
            if (investment.notes.isNotBlank()) {
                Text(investment.notes, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddEditInvestmentDialog(
    initial: InvestmentEntity?,
    types: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (String, String, Double, Double, Double, Long, String) -> Unit
) {
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var selectedType by remember { mutableStateOf(initial?.type ?: "") }
    var units by remember { mutableStateOf(initial?.units?.toString() ?: "") }
    var purchasePrice by remember { mutableStateOf(initial?.purchasePrice?.toString() ?: "") }
    var currentPrice by remember { mutableStateOf(initial?.currentPrice?.toString() ?: "") }
    var notes by remember { mutableStateOf(initial?.notes ?: "") }
    var showDatePicker by remember { mutableStateOf(false) }
    var purchaseDate by remember { mutableStateOf(initial?.purchaseDate ?: System.currentTimeMillis()) }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = purchaseDate)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { purchaseDate = it }
                    showDatePicker = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Cancel") } }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial != null) "Edit Investment" else "Add Investment") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Column {
                    Text("Type *", style = MaterialTheme.typography.bodyMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                        types.forEach { type ->
                            FilterChip(selected = selectedType == type, onClick = { selectedType = type }, label = { Text(type) })
                        }
                    }
                }
                OutlinedTextField(value = units, onValueChange = { units = it }, label = { Text("Units *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = purchasePrice, onValueChange = { purchasePrice = it }, label = { Text("Purchase Price (per unit) *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = currentPrice, onValueChange = { currentPrice = it }, label = { Text("Current Price (per unit) *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                TextButton(onClick = { showDatePicker = true }) {
                    Text("Purchase Date: ${SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(purchaseDate))}")
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val u = units.toDoubleOrNull()
                    val pp = purchasePrice.toDoubleOrNull()
                    val cp = currentPrice.toDoubleOrNull()
                    if (name.isNotBlank() && selectedType.isNotBlank() && u != null && u > 0 && pp != null && pp > 0 && cp != null && cp > 0) {
                        onConfirm(name.trim(), selectedType, u, pp, cp, purchaseDate, notes.trim())
                    }
                },
                enabled = name.isNotBlank() && selectedType.isNotBlank() &&
                        (units.toDoubleOrNull() ?: 0.0) > 0 &&
                        (purchasePrice.toDoubleOrNull() ?: 0.0) > 0 &&
                        (currentPrice.toDoubleOrNull() ?: 0.0) > 0
            ) { Text(if (initial != null) "Save" else "Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
