package com.clarity.app.ui.screens.budget

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.ui.viewmodel.BudgetMainViewModel
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

private val fmt0 = DecimalFormat("##,##,##0.##", DecimalFormatSymbols(Locale("en", "IN")))

@Composable
fun BudgetMainScreen(
    viewModel: BudgetMainViewModel = hiltViewModel(),
    onNavigateToBank: () -> Unit = {},
    onNavigateToCreditCards: () -> Unit = {},
    onNavigateToInvestments: () -> Unit = {},
    onNavigateToSources: () -> Unit = {},
    onNavigateToMetrics: () -> Unit = {}
) {
    val balance by viewModel.balance.collectAsStateWithLifecycle()
    val cardsWithOutstanding by viewModel.cardsWithOutstanding.collectAsStateWithLifecycle()
    val investments by viewModel.investments.collectAsStateWithLifecycle()

    val totalInvestmentValue = remember(investments) {
        investments.sumOf { it.units * it.currentPrice }
    }
    val totalCCSpends = remember(cardsWithOutstanding) {
        cardsWithOutstanding.sumOf { it.outstanding }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Default.AccountBalance,
                    label = "Bank Balance",
                    value = "\u20B9${fmt0.format(balance)}",
                    valueColor = MaterialTheme.colorScheme.primary,
                    onClick = onNavigateToBank
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.AutoMirrored.Filled.ShowChart,
                    label = "Investment Balance",
                    value = "\u20B9${fmt0.format(totalInvestmentValue)}",
                    valueColor = MaterialTheme.colorScheme.tertiary
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Default.CreditCard,
                    label = "CC Spends",
                    value = "\u20B9${fmt0.format(totalCCSpends)}",
                    valueColor = MaterialTheme.colorScheme.error
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                NavCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Default.AccountBalance,
                    title = "BANK",
                    subtitle = "Manage income & spending",
                    onClick = onNavigateToBank
                )
                NavCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Default.CreditCard,
                    title = "Credit Cards",
                    subtitle = "Track card spends",
                    onClick = onNavigateToCreditCards
                )
            }
        }

        item {
            NavCard(
                modifier = Modifier.fillMaxWidth(),
                icon = Icons.AutoMirrored.Filled.ShowChart,
                title = "Investments",
                subtitle = "Track your portfolio",
                onClick = onNavigateToInvestments
            )
        }

        item {
            NavCard(
                modifier = Modifier.fillMaxWidth(),
                icon = Icons.Default.DateRange,
                title = "Metrics",
                subtitle = "Monthly bank, card & investment summary",
                onClick = onNavigateToMetrics
            )
        }
    }
}

@Composable
private fun StatCard(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    label: String,
    value: String,
    valueColor: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit = {}
) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, contentDescription = null, tint = valueColor, modifier = Modifier.padding(bottom = 4.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = valueColor, textAlign = TextAlign.Center, maxLines = 1)
        }
    }
}

@Composable
private fun NavCard(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(bottom = 8.dp))
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        }
    }
}
