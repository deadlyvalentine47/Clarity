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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
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
import com.clarity.app.data.local.database.CreditCardEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.CardWithDetails
import com.clarity.app.ui.viewmodel.CreditCardViewModel
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

private val fmt0 = DecimalFormat("##,##,##0.##", DecimalFormatSymbols(Locale("en", "IN")))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreditCardsScreen(
    viewModel: CreditCardViewModel = hiltViewModel(),
    onBack: () -> Unit = {},
    onCardClick: (Long) -> Unit = {}
) {
    val cardsWithDetails by viewModel.cardsWithDetails.collectAsStateWithLifecycle()
    var showAddDialog by remember { mutableStateOf(false) }
    var cardToDelete by remember { mutableStateOf<CreditCardEntity?>(null) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Card")
            }
        }
    ) { padding ->
        if (cardsWithDetails.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("No credit cards added yet", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 80.dp)
            ) {
                items(cardsWithDetails, key = { it.card.id }) { cwd ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { onCardClick(cwd.card.id) }
                    ) {
                        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(cwd.card.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("Billing cycle: ${cwd.card.billingCycleDay}th of month", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                IconButton(onClick = { cardToDelete = cwd.card }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Limit", style = MaterialTheme.typography.bodySmall)
                                    Text("\u20B9${fmt0.format(cwd.card.creditLimit)}", style = MaterialTheme.typography.titleMedium)
                                }
                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("Outstanding", style = MaterialTheme.typography.bodySmall)
                                    Text(
                                        "\u20B9${fmt0.format(cwd.outstanding)}",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = if (cwd.outstanding <= 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                                    )
                                }
                                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                                    Text("Available", style = MaterialTheme.typography.bodySmall)
                                    Text("\u20B9${fmt0.format(cwd.available)}", style = MaterialTheme.typography.titleMedium, color = if (cwd.available >= 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            val usage = if (cwd.card.creditLimit > 0) (cwd.outstanding / cwd.card.creditLimit).toFloat().coerceIn(0f, 1f) else 0f
                            Box(modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(MaterialTheme.colorScheme.surfaceVariant)) {
                                Box(modifier = Modifier.fillMaxWidth(usage).height(8.dp).clip(RoundedCornerShape(4.dp)).background(if (usage < 0.7f) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error))
                            }
                            Text("${(usage * 100).toInt()}% utilized", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AddCardDialog(
            onDismiss = { showAddDialog = false },
            onConfirm = { name, limit, cycleDay ->
                viewModel.addCard(name, limit, cycleDay)
                showAddDialog = false
            }
        )
    }

    cardToDelete?.let { card ->
        DeleteConfirmationDialog(
            title = "Delete Card",
            message = "Delete \"${card.name}\"? All transactions for this card will also be removed.",
            onConfirm = { viewModel.deleteCard(card); cardToDelete = null },
            onDismiss = { cardToDelete = null }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddCardDialog(
    onDismiss: () -> Unit,
    onConfirm: (String, Double, Int) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var limit by remember { mutableStateOf("") }
    var cycleDay by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Credit Card") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Card Name *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = limit, onValueChange = { limit = it }, label = { Text("Credit Limit *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = cycleDay, onValueChange = { cycleDay = it }, label = { Text("Billing Cycle Day (1-31) *") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val limitVal = limit.toDoubleOrNull()
                    val dayVal = cycleDay.toIntOrNull()
                    if (name.isNotBlank() && limitVal != null && limitVal > 0 && dayVal != null && dayVal in 1..31) {
                        onConfirm(name.trim(), limitVal, dayVal)
                    }
                },
                enabled = name.isNotBlank() && (limit.toDoubleOrNull() ?: 0.0) > 0 && (cycleDay.toIntOrNull() ?: 0) in 1..31
            ) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
