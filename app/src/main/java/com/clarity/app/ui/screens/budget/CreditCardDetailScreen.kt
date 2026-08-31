package com.clarity.app.ui.screens.budget

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.CreditCardEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.CreditCardViewModel
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale

private val fmt0 = DecimalFormat("##,##,##0.##", DecimalFormatSymbols(Locale("en", "IN")))
private val monthFmt = DateTimeFormatter.ofPattern("MMM yyyy")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreditCardDetailScreen(
    cardId: Long,
    viewModel: CreditCardViewModel = hiltViewModel(),
    onBack: () -> Unit = {}
) {
    val cards by viewModel.cards.collectAsStateWithLifecycle()
    val transactions by viewModel.selectedCardTransactions.collectAsStateWithLifecycle()
    var showAddDialog by remember { mutableStateOf(false) }
    var showEditDialog by remember { mutableStateOf(false) }
    var addType by remember { mutableStateOf("Purchase") }
    var txToDelete by remember { mutableStateOf<Long?>(null) }

    LaunchedEffect(cardId) {
        viewModel.selectCard(cardId)
    }

    val card = cards.find { it.id == cardId }

    if (card == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Card not found", style = MaterialTheme.typography.bodyLarge)
        }
        return
    }

    var selectedYM by remember { mutableStateOf(YearMonth.now()) }

    val filteredTransactions = transactions.filter { tx ->
        val cal = java.util.Calendar.getInstance()
        cal.timeInMillis = tx.date
        val txYM = YearMonth.of(cal.get(java.util.Calendar.YEAR), cal.get(java.util.Calendar.MONTH) + 1)
        txYM == selectedYM
    }

    val purchases = transactions.filter { it.type == "Purchase" }.sumOf { it.amount }
    val payments = transactions.filter { it.type == "Payment" }.sumOf { it.amount }
    val outstanding = purchases - payments
    val available = card.creditLimit - outstanding
    val usage = (outstanding / card.creditLimit).toFloat().coerceIn(0f, 1f)

    Scaffold(
        floatingActionButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FloatingActionButton(onClick = { addType = "Purchase"; showAddDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = "Add Purchase")
                }
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
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Credit Limit", style = MaterialTheme.typography.labelLarge)
                                Text("\u20B9${fmt0.format(card.creditLimit)}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                            }
                            IconButton(onClick = { showEditDialog = true }) {
                                Icon(Icons.Default.Edit, contentDescription = "Edit Card", tint = MaterialTheme.colorScheme.onPrimaryContainer)
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column { Text("Outstanding", style = MaterialTheme.typography.bodySmall); Text("\u20B9${fmt0.format(outstanding)}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.error) }
                            Column(horizontalAlignment = Alignment.End) { Text("Available", style = MaterialTheme.typography.bodySmall); Text("\u20B9${fmt0.format(available)}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary) }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Box(modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(MaterialTheme.colorScheme.surfaceVariant)) {
                            Box(modifier = Modifier.fillMaxWidth(usage).height(8.dp).clip(RoundedCornerShape(4.dp)).background(if (usage < 0.7f) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error))
                        }
                        Text("${(usage * 100).toInt()}% utilized", style = MaterialTheme.typography.bodySmall)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Billing cycle: ${card.billingCycleDay}th of month", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            item {
                MonthSelectorRowWithDropdown(
                    selectedYM = selectedYM,
                    onSelectYM = { selectedYM = it },
                    onPrev = { selectedYM = selectedYM.minusMonths(1) },
                    onNext = { selectedYM = selectedYM.plusMonths(1) }
                )
            }

            item { Text("Transactions", style = MaterialTheme.typography.titleMedium) }

            items(filteredTransactions, key = { it.id }) { tx ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(tx.description.ifBlank { tx.type }, style = MaterialTheme.typography.bodyLarge)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(tx.type, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(tx.date)), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                if (tx.type == "Purchase") "-\u20B9${fmt0.format(tx.amount)}" else "+\u20B9${fmt0.format(tx.amount)}",
                                style = MaterialTheme.typography.titleMedium,
                                color = if (tx.type == "Purchase") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                            )
                            IconButton(onClick = { txToDelete = tx.id }) {
                                Icon(Icons.Default.Close, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }

            if (filteredTransactions.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("No transactions yet", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AddCardTransactionDialog(
            type = addType,
            onDismiss = { showAddDialog = false },
            onConfirm = { amount, description ->
                if (addType == "Purchase") {
                    viewModel.addPurchase(cardId, amount, description)
                } else {
                    viewModel.addPayment(cardId, amount, description)
                }
                showAddDialog = false
            }
        )
    }

    if (showEditDialog) {
        EditCardDialog(
            card = card,
            onDismiss = { showEditDialog = false },
            onConfirm = { updated ->
                viewModel.updateCard(updated)
                showEditDialog = false
            }
        )
    }

    txToDelete?.let { txId ->
        val tx = filteredTransactions.find { it.id == txId }
        if (tx != null) {
            DeleteConfirmationDialog(
                title = "Delete Transaction",
                message = "Are you sure?",
                onConfirm = { viewModel.deleteTransaction(tx); txToDelete = null },
                onDismiss = { txToDelete = null }
            )
        }
    }
}

@Composable
fun MonthSelectorRowWithDropdown(
    selectedYM: YearMonth,
    onSelectYM: (YearMonth) -> Unit,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier
) {
    var dropdownExpanded by remember { mutableStateOf(false) }

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onPrev) { Icon(Icons.Default.ChevronLeft, contentDescription = "Previous") }
        Box {
            Text(
                text = selectedYM.format(monthFmt),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .width(160.dp)
                    .clickable { dropdownExpanded = true }
            )
            DropdownMenu(
                expanded = dropdownExpanded,
                onDismissRequest = { dropdownExpanded = false }
            ) {
                val now = YearMonth.now()
                val startMonth = now.minusMonths(11)
                val months = generateSequence(startMonth) { it.plusMonths(1) }
                    .take(24)
                    .toList()
                months.forEach { ym ->
                    DropdownMenuItem(
                        text = {
                            Text(
                                text = ym.format(monthFmt),
                                color = if (ym == selectedYM) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                            )
                        },
                        onClick = {
                            onSelectYM(ym)
                            dropdownExpanded = false
                        }
                    )
                }
            }
        }
        IconButton(onClick = onNext) { Icon(Icons.Default.ChevronRight, contentDescription = "Next") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditCardDialog(
    card: CreditCardEntity,
    onDismiss: () -> Unit,
    onConfirm: (CreditCardEntity) -> Unit
) {
    var name by remember { mutableStateOf(card.name) }
    var creditLimit by remember { mutableStateOf(card.creditLimit.toString()) }
    var billingCycleDay by remember { mutableStateOf(card.billingCycleDay.toString()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Credit Card") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.verticalScroll(rememberScrollState())) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Card Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = creditLimit,
                    onValueChange = { creditLimit = it },
                    label = { Text("Credit Limit *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = billingCycleDay,
                    onValueChange = { billingCycleDay = it.filter { c -> c.isDigit() } },
                    label = { Text("Billing Cycle Day (1-31) *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val limit = creditLimit.toDoubleOrNull()
                    val cycleDay = billingCycleDay.toIntOrNull()
                    if (name.isNotBlank() && limit != null && limit > 0 && cycleDay != null && cycleDay in 1..31) {
                        onConfirm(card.copy(name = name.trim(), creditLimit = limit, billingCycleDay = cycleDay))
                    }
                },
                enabled = name.isNotBlank() &&
                        (creditLimit.toDoubleOrNull() ?: 0.0) > 0 &&
                        (billingCycleDay.toIntOrNull() ?: 0) in 1..31
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddCardTransactionDialog(
    type: String,
    onDismiss: () -> Unit,
    onConfirm: (Double, String) -> Unit
) {
    var amount by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add $type") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Amount *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val amt = amount.toDoubleOrNull()
                    if (amt != null && amt > 0) {
                        onConfirm(amt, description.trim())
                    }
                },
                enabled = (amount.toDoubleOrNull() ?: 0.0) > 0
            ) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
