package com.clarity.app.ui.screens.budget

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.material3.TopAppBar
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
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clarity.app.data.local.database.BudgetLimitEntity
import com.clarity.app.data.local.database.CategoryEntity
import com.clarity.app.data.local.database.SourceEntity
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.ui.components.DeleteConfirmationDialog
import com.clarity.app.ui.viewmodel.BudgetViewModel
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private val indianFormat = DecimalFormat(
    "##,##,##0.00",
    DecimalFormatSymbols(Locale("en", "IN"))
)
private val indianFormatNoDecimal = DecimalFormat(
    "##,##,##0",
    DecimalFormatSymbols(Locale("en", "IN"))
)

private fun formatIndian(amount: Double): String = indianFormat.format(amount)
private fun formatIndianNoDecimal(amount: Double): String = indianFormatNoDecimal.format(amount)

private fun getDayName(dayOfMonth: Int): String {
    val cal = Calendar.getInstance()
    cal.set(Calendar.DAY_OF_MONTH, dayOfMonth)
    return SimpleDateFormat("EEE", Locale.getDefault()).format(cal.time)
}

private fun getMonthName(month: Int): String {
    val cal = Calendar.getInstance()
    cal.set(Calendar.MONTH, month - 1)
    return SimpleDateFormat("MMMM", Locale.getDefault()).format(cal.time)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BudgetScreen(
    viewModel: BudgetViewModel = hiltViewModel()
) {
    val transactions by viewModel.transactions.collectAsStateWithLifecycle()
    val balance by viewModel.balance.collectAsStateWithLifecycle()
    val totalIncome by viewModel.totalIncome.collectAsStateWithLifecycle()
    val totalExpenses by viewModel.totalExpenses.collectAsStateWithLifecycle()
    val categories by viewModel.categories.collectAsStateWithLifecycle()
    val sources by viewModel.sources.collectAsStateWithLifecycle()
    val budgetLimits by viewModel.budgetLimits.collectAsStateWithLifecycle()
    var showAddDialog by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableStateOf("Overview") }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Transaction")
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("Overview", "Transactions", "Charts", "Manage").forEach { tab ->
                    FilterChip(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        label = { Text(tab) }
                    )
                }
            }

            when (selectedTab) {
                "Overview" -> OverviewTab(
                    totalIncome = totalIncome,
                    totalExpenses = totalExpenses,
                    balance = balance,
                    transactions = transactions
                )
                "Transactions" -> TransactionsTab(
                    transactions = transactions,
                    categories = categories,
                    sources = sources,
                    onDelete = { viewModel.deleteTransaction(it) },
                    onSwitchToManage = { selectedTab = "Manage" }
                )
                "Charts" -> ChartsTab(
                    transactions = transactions
                )
                "Manage" -> ManageTab(
                    categories = categories,
                    sources = sources,
                    transactions = transactions,
                    budgetLimits = budgetLimits,
                    onAddCategory = { viewModel.addCategory(it) },
                    onDeleteCategory = { viewModel.deleteCategory(it) },
                    onAddSource = { viewModel.addSource(it) },
                    onDeleteSource = { viewModel.deleteSource(it) },
                    onSetBudgetLimit = { categoryName, amount ->
                        viewModel.addBudgetLimit(BudgetLimitEntity(
                            category = categoryName,
                            limitAmount = amount,
                            month = java.time.LocalDate.now().monthValue,
                            year = java.time.LocalDate.now().year
                        ))
                    },
                    onDeleteBudgetLimit = { viewModel.deleteBudgetLimit(it) }
                )
            }
        }
    }

    if (showAddDialog) {
        AddTransactionDialog(
            categories = categories.map { it.name },
            sources = sources.map { it.name },
            onDismiss = { showAddDialog = false },
            onConfirm = { transaction ->
                viewModel.addTransaction(transaction)
                showAddDialog = false
            }
        )
    }
}

@Composable
fun ManageTab(
    categories: List<CategoryEntity>,
    sources: List<SourceEntity>,
    transactions: List<TransactionEntity>,
    budgetLimits: List<BudgetLimitEntity>,
    onAddCategory: (String) -> Unit,
    onDeleteCategory: (CategoryEntity) -> Unit,
    onAddSource: (String) -> Unit,
    onDeleteSource: (SourceEntity) -> Unit,
    onSetBudgetLimit: (String, Double) -> Unit,
    onDeleteBudgetLimit: (BudgetLimitEntity) -> Unit
) {
    var showAddCategoryDialog by remember { mutableStateOf(false) }
    var showAddSourceDialog by remember { mutableStateOf(false) }
    var categoryToDelete by remember { mutableStateOf<CategoryEntity?>(null) }
    var sourceToDelete by remember { mutableStateOf<SourceEntity?>(null) }
    var categoriesExpanded by remember { mutableStateOf(true) }
    var sourcesExpanded by remember { mutableStateOf(true) }
    var categorySearch by remember { mutableStateOf("") }
    var sourceSearch by remember { mutableStateOf("") }
    var limitCategory by remember { mutableStateOf<String?>(null) }
    var limitToDelete by remember { mutableStateOf<BudgetLimitEntity?>(null) }

    val filteredCategories = categories.filter {
        it.name.contains(categorySearch, ignoreCase = true)
    }
    val filteredSources = sources.filter {
        it.name.contains(sourceSearch, ignoreCase = true)
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { categoriesExpanded = !categoriesExpanded }
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "CATEGORIES (${categories.size})",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { showAddCategoryDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Category")
                    }
                    Icon(
                        imageVector = if (categoriesExpanded) Icons.Default.KeyboardArrowUp
                        else Icons.Default.KeyboardArrowDown,
                        contentDescription = if (categoriesExpanded) "Collapse" else "Expand"
                    )
                }
            }
        }

        if (categoriesExpanded) {
            item {
                OutlinedTextField(
                    value = categorySearch,
                    onValueChange = { categorySearch = it },
                    label = { Text("Search categories") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
                )
            }

            items(filteredCategories) { category ->
                val categoryLimit = budgetLimits.find { it.category == category.name }
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = category.name,
                                style = MaterialTheme.typography.bodyLarge
                            )
                            if (categoryLimit != null) {
                                Text(
                                    text = "Limit: \u20B9${formatIndianNoDecimal(categoryLimit.limitAmount)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                        Row {
                            IconButton(onClick = { limitCategory = category.name }) {
                                Icon(
                                    Icons.Default.AccountBalance,
                                    contentDescription = if (categoryLimit != null) "Edit Limit" else "Set Limit",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            if (!category.isDefault) {
                                IconButton(onClick = { categoryToDelete = category }) {
                                    Icon(
                                        Icons.Default.Delete,
                                        contentDescription = "Delete Category",
                                        tint = MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { sourcesExpanded = !sourcesExpanded }
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "SOURCES (${sources.size})",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { showAddSourceDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Source")
                    }
                    Icon(
                        imageVector = if (sourcesExpanded) Icons.Default.KeyboardArrowUp
                        else Icons.Default.KeyboardArrowDown,
                        contentDescription = if (sourcesExpanded) "Collapse" else "Expand"
                    )
                }
            }
        }

        if (sourcesExpanded) {
            item {
                OutlinedTextField(
                    value = sourceSearch,
                    onValueChange = { sourceSearch = it },
                    label = { Text("Search sources") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
                )
            }

            items(filteredSources) { source ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = source.name,
                                style = MaterialTheme.typography.bodyLarge
                            )
                            if (source.isDefault) {
                                Text(
                                    text = "Default",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        if (!source.isDefault) {
                            IconButton(onClick = { sourceToDelete = source }) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = "Delete Source",
                                    tint = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddCategoryDialog) {
        AddItemDialog(
            title = "Add Category",
            itemName = "Category",
            onDismiss = { showAddCategoryDialog = false },
            onConfirm = { name ->
                onAddCategory(name)
                showAddCategoryDialog = false
            }
        )
    }

    if (showAddSourceDialog) {
        AddItemDialog(
            title = "Add Source",
            itemName = "Source",
            onDismiss = { showAddSourceDialog = false },
            onConfirm = { name ->
                onAddSource(name)
                showAddSourceDialog = false
            }
        )
    }

    categoryToDelete?.let { category ->
        val txCount = transactions.count { it.category == category.name }
        val budgetCount = budgetLimits.count { it.category == category.name }
        val refCount = txCount + budgetCount
        val message = buildString {
            append("Are you sure you want to delete \"${category.name}\"?")
            if (refCount > 0) {
                append("\n\nThis category is used in $refCount ")
                append(if (refCount == 1) "record" else "records")
                append(" (")
                append(
                    listOfNotNull(
                        if (txCount > 0) "${txCount} transaction${if (txCount != 1) "s" else ""}" else null,
                        if (budgetCount > 0) "${budgetCount} budget limit${if (budgetCount != 1) "s" else ""}" else null
                    ).joinToString(", ")
                )
                append("). Deleting it may orphan this data.")
            }
        }
        DeleteConfirmationDialog(
            title = "Delete Category",
            message = message,
            onConfirm = {
                onDeleteCategory(category)
                categoryToDelete = null
            },
            onDismiss = { categoryToDelete = null }
        )
    }

    sourceToDelete?.let { source ->
        val txCount = transactions.count { it.source == source.name }
        val message = buildString {
            append("Are you sure you want to delete \"${source.name}\"?")
            if (txCount > 0) {
                append("\n\nThis source is used in $txCount transaction${if (txCount != 1) "s" else ""}. Deleting it may orphan this data.")
            }
        }
        DeleteConfirmationDialog(
            title = "Delete Source",
            message = message,
            onConfirm = {
                onDeleteSource(source)
                sourceToDelete = null
            },
            onDismiss = { sourceToDelete = null }
        )
    }

    limitCategory?.let { catName ->
        val existingLimit = budgetLimits.find { it.category == catName }
        var limitAmount by remember(catName) { mutableStateOf(existingLimit?.limitAmount?.toString() ?: "") }
        AlertDialog(
            onDismissRequest = { limitCategory = null },
            title = { Text("Set Monthly Limit for $catName") },
            text = {
                OutlinedTextField(
                    value = limitAmount,
                    onValueChange = { limitAmount = it },
                    label = { Text("Limit Amount") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val amount = limitAmount.toDoubleOrNull()
                        if (amount != null && amount > 0) {
                            onSetBudgetLimit(catName, amount)
                            limitCategory = null
                        }
                    },
                    enabled = limitAmount.toDoubleOrNull() != null && (limitAmount.toDoubleOrNull() ?: 0.0) > 0
                ) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { limitCategory = null }) { Text("Cancel") } }
        )
    }

    limitToDelete?.let { limit ->
        DeleteConfirmationDialog(
            title = "Delete Budget Limit",
            message = "Are you sure you want to remove the limit for \"${limit.category}\"?",
            onConfirm = {
                onDeleteBudgetLimit(limit)
                limitToDelete = null
            },
            onDismiss = { limitToDelete = null }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddItemDialog(
    title: String,
    itemName: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var name by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("$itemName Name *") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(name.trim()) },
                enabled = name.isNotBlank()
            ) {
                Text("Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun ChartsTab(
    transactions: List<TransactionEntity>
) {
    val expenses = transactions.filter { it.type == "Expense" }
    val categoryTotals = expenses
        .groupBy { it.category }
        .map { (category, trans) ->
            category to trans.sumOf { it.amount }
        }
        .sortedByDescending { it.second }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "SPENDING BY CATEGORY",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (categoryTotals.isEmpty()) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "No expense data to display",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Category Breakdown",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Spacer(modifier = Modifier.height(16.dp))

                        val maxAmount = categoryTotals.maxOfOrNull { it.second } ?: 1.0
                        categoryTotals.forEach { (category, amount) ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = category,
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.widthIn(min = 60.dp, max = 100.dp)
                                )
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(20.dp)
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(MaterialTheme.colorScheme.primaryContainer)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth((amount / maxAmount).toFloat())
                                            .height(20.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(MaterialTheme.colorScheme.primary)
                                    )
                                }
                                Text(
                                    text = "\u20B9${formatIndianNoDecimal(amount)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(start = 8.dp)
                                )
                            }
                        }
                    }
                }
            }

            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Spending by Source",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Spacer(modifier = Modifier.height(16.dp))

                        val sourceTotals = expenses
                            .groupBy { it.source.ifBlank { "Unknown" } }
                            .map { (source, trans) ->
                                source to trans.sumOf { it.amount }
                            }
                            .sortedByDescending { it.second }

                        if (sourceTotals.isNotEmpty()) {
                            val maxSource = sourceTotals.maxOfOrNull { it.second } ?: 1.0
                            sourceTotals.forEach { (source, amount) ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = source,
                                        style = MaterialTheme.typography.bodySmall,
                                        modifier = Modifier.widthIn(min = 60.dp, max = 100.dp)
                                    )
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(20.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(MaterialTheme.colorScheme.secondaryContainer)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth((amount / maxSource).toFloat())
                                                .height(20.dp)
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(MaterialTheme.colorScheme.secondary)
                                        )
                                    }
                                    Text(
                                        text = "\u20B9${formatIndianNoDecimal(amount)}",
                                        style = MaterialTheme.typography.bodySmall,
                                        modifier = Modifier.padding(start = 8.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Daily Spending Trend",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Spacer(modifier = Modifier.height(16.dp))

                        val dailySpending = expenses
                            .groupBy {
                                SimpleDateFormat("MMM dd", Locale.getDefault()).format(Date(it.date))
                            }
                            .map { (date, trans) ->
                                date to trans.sumOf { it.amount }
                            }
                            .takeLast(7)

                        if (dailySpending.isNotEmpty()) {
                            val maxDaily = dailySpending.maxOfOrNull { it.second } ?: 1.0
                            dailySpending.forEach { (date, amount) ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = date,
                                        style = MaterialTheme.typography.bodySmall,
                                        modifier = Modifier.widthIn(min = 60.dp, max = 100.dp)
                                    )
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(20.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(MaterialTheme.colorScheme.tertiaryContainer)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth((amount / maxDaily).toFloat())
                                                .height(20.dp)
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(MaterialTheme.colorScheme.tertiary)
                                        )
                                    }
                                    Text(
                                        text = "\u20B9${formatIndianNoDecimal(amount)}",
                                        style = MaterialTheme.typography.bodySmall,
                                        modifier = Modifier.padding(start = 8.dp)
                                    )
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
fun OverviewTab(
    totalIncome: Double,
    totalExpenses: Double,
    balance: Double,
    transactions: List<TransactionEntity>
) {
    val today = Calendar.getInstance()
    val startOfDay = today.clone() as Calendar
    startOfDay.set(Calendar.HOUR_OF_DAY, 0)
    startOfDay.set(Calendar.MINUTE, 0)
    startOfDay.set(Calendar.SECOND, 0)
    startOfDay.set(Calendar.MILLISECOND, 0)

    val startOfMonth = today.clone() as Calendar
    startOfMonth.set(Calendar.DAY_OF_MONTH, 1)
    startOfMonth.set(Calendar.HOUR_OF_DAY, 0)
    startOfMonth.set(Calendar.MINUTE, 0)
    startOfMonth.set(Calendar.SECOND, 0)
    startOfMonth.set(Calendar.MILLISECOND, 0)

    val todayExpenses = transactions
        .filter { it.type == "Expense" && it.date >= startOfDay.timeInMillis }
        .sumOf { it.amount }

    val monthExpenses = transactions
        .filter { it.type == "Expense" && it.date >= startOfMonth.timeInMillis }
        .sumOf { it.amount }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "BALANCE",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Income", style = MaterialTheme.typography.bodySmall)
                            Text(
                                text = "\u20B9${formatIndian(totalIncome)}",
                                style = MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        Column {
                            Text("Expenses", style = MaterialTheme.typography.bodySmall)
                            Text(
                                text = "-\u20B9${formatIndian(totalExpenses)}",
                                style = MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                        Column {
                            Text("Balance", style = MaterialTheme.typography.bodySmall)
                            Text(
                                text = "\u20B9${formatIndian(balance)}",
                                style = MaterialTheme.typography.titleLarge,
                                color = if (balance >= 0) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp)
                    ) {
                        Text(
                            text = "Today",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                        Text(
                            text = "\u20B9${formatIndian(todayExpenses)}",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.tertiaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp)
                    ) {
                        Text(
                            text = "This Month",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onTertiaryContainer
                        )
                        Text(
                            text = "\u20B9${formatIndian(monthExpenses)}",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onTertiaryContainer
                        )
                    }
                }
            }
        }

        item {
            Text(
                text = "CATEGORY BREAKDOWN",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        val categoryTotals = transactions
            .filter { it.type == "Expense" }
            .groupBy { it.category }
            .map { (category, trans) ->
                category to trans.sumOf { it.amount }
            }
            .sortedByDescending { it.second }

        if (categoryTotals.isEmpty()) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "No expenses yet",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            items(categoryTotals) { (category, amount) ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = category,
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Text(
                            text = "\u20B9${formatIndian(amount)}",
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionsTab(
    transactions: List<TransactionEntity>,
    categories: List<CategoryEntity>,
    sources: List<SourceEntity>,
    onDelete: (TransactionEntity) -> Unit,
    onSwitchToManage: () -> Unit
) {
    var showFilterSheet by remember { mutableStateOf(false) }
    var selectedFilterCategory by remember { mutableStateOf("Type") }

    var selectedTypes by remember { mutableStateOf(setOf<String>()) }
    var selectedDays by remember { mutableStateOf(setOf<Int>()) }
    var selectedMonths by remember { mutableStateOf(setOf<Int>()) }
    var selectedYears by remember { mutableStateOf(setOf<Int>()) }
    var selectedCategories by remember { mutableStateOf(setOf<String>()) }
    var selectedSources by remember { mutableStateOf(setOf<String>()) }

    val now = Calendar.getInstance()
    val currentMonth = now.get(Calendar.MONTH) + 1
    val currentYear = now.get(Calendar.YEAR)

    val hasActiveFilters = selectedTypes.isNotEmpty() || selectedDays.isNotEmpty() ||
            selectedMonths.isNotEmpty() || selectedYears.isNotEmpty() ||
            selectedCategories.isNotEmpty() || selectedSources.isNotEmpty()

    val activeFilterCount = selectedTypes.size + selectedDays.size + selectedMonths.size +
            selectedYears.size + selectedCategories.size + selectedSources.size

    val filteredTransactions = transactions.filter { transaction ->
        val cal = Calendar.getInstance()
        cal.timeInMillis = transaction.date
        val transDay = cal.get(Calendar.DAY_OF_MONTH)
        val transMonth = cal.get(Calendar.MONTH) + 1
        val transYear = cal.get(Calendar.YEAR)

        val matchesType = selectedTypes.isEmpty() || transaction.type in selectedTypes
        val matchesMonth = selectedMonths.isEmpty() || transMonth in selectedMonths
        val matchesDay = selectedDays.isEmpty() || transDay in selectedDays
        val matchesYear = selectedYears.isEmpty() || transYear in selectedYears
        val matchesCategory = selectedCategories.isEmpty() || transaction.category in selectedCategories
        val matchesSource = selectedSources.isEmpty() || transaction.source in selectedSources

        matchesType && matchesMonth && matchesDay && matchesYear && matchesCategory && matchesSource
    }

    val groupedTransactions = if (selectedDays.isNotEmpty()) {
        filteredTransactions.groupBy { null }
    } else if (selectedMonths.isNotEmpty() || selectedYears.isNotEmpty()) {
        filteredTransactions.groupBy {
            val cal = Calendar.getInstance()
            cal.timeInMillis = it.date
            cal.get(Calendar.DAY_OF_MONTH)
        }.toSortedMap()
    } else {
        filteredTransactions.groupBy {
            val cal = Calendar.getInstance()
            cal.timeInMillis = it.date
            cal.get(Calendar.DAY_OF_MONTH)
        }.toSortedMap()
    }

    val uniqueDays = transactions.map {
        val cal = Calendar.getInstance()
        cal.timeInMillis = it.date
        cal.get(Calendar.DAY_OF_MONTH)
    }.distinct().sorted()

    val uniqueMonths = transactions.map {
        val cal = Calendar.getInstance()
        cal.timeInMillis = it.date
        cal.get(Calendar.MONTH) + 1
    }.distinct().sorted()

    val uniqueYears = transactions.map {
        val cal = Calendar.getInstance()
        cal.timeInMillis = it.date
        cal.get(Calendar.YEAR)
    }.distinct().sorted()

    val uniqueCategories = transactions.map { it.category }.distinct().sorted()
    val uniqueSources = transactions.map { it.source }.filter { it.isNotBlank() }.distinct().sorted()

    if (transactions.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "No transactions yet",
                    style = MaterialTheme.typography.headlineMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Tap + to add your first transaction",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    } else if (categories.isEmpty() || sources.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "Set up categories and sources",
                    style = MaterialTheme.typography.headlineSmall
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Go to Manage tab to add categories and sources before adding transactions",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(16.dp))
                TextButton(onClick = onSwitchToManage) {
                    Text("Go to Manage")
                }
            }
        }
    } else {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${filteredTransactions.size} transactions",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (hasActiveFilters) {
                        TextButton(onClick = {
                            selectedTypes = emptySet()
                            selectedDays = emptySet()
                            selectedMonths = emptySet()
                            selectedYears = emptySet()
                            selectedCategories = emptySet()
                            selectedSources = emptySet()
                        }) {
                            Text("Clear")
                        }
                    }
                    Box {
                        IconButton(onClick = { showFilterSheet = true }) {
                            BadgedBox(
                                badge = {
                                    if (activeFilterCount > 0) {
                                        Badge { Text("$activeFilterCount") }
                                    }
                                }
                            ) {
                                Icon(
                                    Icons.Default.DateRange,
                                    contentDescription = "Filter"
                                )
                            }
                        }
                    }
                }
            }

            if (hasActiveFilters) {
                LazyRow(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(selectedTypes.toList()) { type ->
                        FilterChip(
                            selected = true,
                            onClick = { selectedTypes = selectedTypes - type },
                            label = { Text(type) },
                            trailingIcon = {
                                Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                    items(selectedMonths.toList()) { month ->
                        FilterChip(
                            selected = true,
                            onClick = { selectedMonths = selectedMonths - month },
                            label = { Text(getMonthName(month)) },
                            trailingIcon = {
                                Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                    items(selectedDays.toList()) { day ->
                        FilterChip(
                            selected = true,
                            onClick = { selectedDays = selectedDays - day },
                            label = { Text("$day-${getDayName(day)}") },
                            trailingIcon = {
                                Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                    items(selectedYears.toList()) { year ->
                        FilterChip(
                            selected = true,
                            onClick = { selectedYears = selectedYears - year },
                            label = { Text("$year") },
                            trailingIcon = {
                                Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                    items(selectedCategories.toList()) { cat ->
                        FilterChip(
                            selected = true,
                            onClick = { selectedCategories = selectedCategories - cat },
                            label = { Text(cat) },
                            trailingIcon = {
                                Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                    items(selectedSources.toList()) { src ->
                        FilterChip(
                            selected = true,
                            onClick = { selectedSources = selectedSources - src },
                            label = { Text(src) },
                            trailingIcon = {
                                Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(16.dp))
                            }
                        )
                    }
                }
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (groupedTransactions.isEmpty()) {
                    item {
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = "No transactions found",
                                modifier = Modifier.padding(16.dp),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    groupedTransactions.forEach { (day, dayTransactions) ->
                        if (day != null) {
                            item {
                                val dayTotal = dayTransactions.sumOf {
                                    if (it.type == "Expense") -it.amount else it.amount
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "$day-${getDayName(day)}",
                                        style = MaterialTheme.typography.titleSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Text(
                                        text = "\u20B9${formatIndian(dayTotal)}",
                                        style = MaterialTheme.typography.titleSmall,
                                        color = if (dayTotal >= 0) MaterialTheme.colorScheme.primary
                                        else MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                        }
                        items(dayTransactions, key = { it.id }) { transaction ->
                            TransactionItem(
                                transaction = transaction,
                                onDelete = { onDelete(transaction) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showFilterSheet) {
        FilterBottomSheet(
            selectedFilterCategory = selectedFilterCategory,
            onFilterCategorySelected = { selectedFilterCategory = it },
            selectedTypes = selectedTypes,
            onTypesChanged = { selectedTypes = it },
            selectedDays = selectedDays,
            onDaysChanged = { selectedDays = it },
            selectedMonths = selectedMonths,
            onMonthsChanged = { selectedMonths = it },
            selectedYears = selectedYears,
            onYearsChanged = { selectedYears = it },
            selectedCategories = selectedCategories,
            onCategoriesChanged = { selectedCategories = it },
            selectedSources = selectedSources,
            onSourcesChanged = { selectedSources = it },
            uniqueDays = uniqueDays,
            uniqueMonths = uniqueMonths,
            uniqueYears = uniqueYears,
            uniqueCategories = uniqueCategories,
            uniqueSources = uniqueSources,
            onDismiss = { showFilterSheet = false },
            onClearAll = {
                selectedTypes = emptySet()
                selectedDays = emptySet()
                selectedMonths = emptySet()
                selectedYears = emptySet()
                selectedCategories = emptySet()
                selectedSources = emptySet()
            }
        )
    }
}

@Composable
fun FilterBottomSheet(
    selectedFilterCategory: String,
    onFilterCategorySelected: (String) -> Unit,
    selectedTypes: Set<String>,
    onTypesChanged: (Set<String>) -> Unit,
    selectedDays: Set<Int>,
    onDaysChanged: (Set<Int>) -> Unit,
    selectedMonths: Set<Int>,
    onMonthsChanged: (Set<Int>) -> Unit,
    selectedYears: Set<Int>,
    onYearsChanged: (Set<Int>) -> Unit,
    selectedCategories: Set<String>,
    onCategoriesChanged: (Set<String>) -> Unit,
    selectedSources: Set<String>,
    onSourcesChanged: (Set<String>) -> Unit,
    uniqueDays: List<Int>,
    uniqueMonths: List<Int>,
    uniqueYears: List<Int>,
    uniqueCategories: List<String>,
    uniqueSources: List<String>,
    onDismiss: () -> Unit,
    onClearAll: () -> Unit
) {
    val filterCategories = if (selectedMonths.isNotEmpty()) {
        listOf("Type", "Month", "Day", "Year", "Category", "Source")
    } else {
        listOf("Type", "Month", "Year", "Category", "Source")
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Filters")
                TextButton(onClick = onClearAll) {
                    Text("Clear All")
                }
            }
        },
        text = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 250.dp, max = 400.dp)
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                ) {
                    filterCategories.forEach { category ->
                        val isSelected = selectedFilterCategory == category
                        val hasSelection = when (category) {
                            "Type" -> selectedTypes.isNotEmpty()
                            "Month" -> selectedMonths.isNotEmpty()
                            "Day" -> selectedDays.isNotEmpty()
                            "Year" -> selectedYears.isNotEmpty()
                            "Category" -> selectedCategories.isNotEmpty()
                            "Source" -> selectedSources.isNotEmpty()
                            else -> false
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onFilterCategorySelected(category) }
                                .background(
                                    if (isSelected) MaterialTheme.colorScheme.primaryContainer
                                    else MaterialTheme.colorScheme.surface
                                )
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = category,
                                style = MaterialTheme.typography.bodyMedium,
                                color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer
                                else MaterialTheme.colorScheme.onSurface
                            )
                            if (hasSelection) {
                                Badge { Text("*") }
                            }
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .weight(2f)
                        .fillMaxHeight()
                        .padding(start = 8.dp)
                ) {
                    when (selectedFilterCategory) {
                        "Type" -> {
                            listOf("Income", "Expense").forEach { type ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            onTypesChanged(
                                                if (type in selectedTypes) selectedTypes - type
                                                else selectedTypes + type
                                            )
                                        }
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    Checkbox(
                                        checked = type in selectedTypes,
                                        onCheckedChange = { checked ->
                                            onTypesChanged(
                                                if (checked) selectedTypes + type
                                                else selectedTypes - type
                                            )
                                        }
                                    )
                                    Text(type, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                        "Month" -> {
                            LazyColumn {
                                items(uniqueMonths) { month ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                onMonthsChanged(
                                                    if (month in selectedMonths) selectedMonths - month
                                                    else selectedMonths + month
                                                )
                                            }
                                            .padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        Checkbox(
                                            checked = month in selectedMonths,
                                            onCheckedChange = { checked ->
                                                onMonthsChanged(
                                                    if (checked) selectedMonths + month
                                                    else selectedMonths - month
                                                )
                                            }
                                        )
                                        Text(getMonthName(month), style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                        "Day" -> {
                            LazyColumn {
                                items(uniqueDays) { day ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                onDaysChanged(
                                                    if (day in selectedDays) selectedDays - day
                                                    else selectedDays + day
                                                )
                                            }
                                            .padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        Checkbox(
                                            checked = day in selectedDays,
                                            onCheckedChange = { checked ->
                                                onDaysChanged(
                                                    if (checked) selectedDays + day
                                                    else selectedDays - day
                                                )
                                            }
                                        )
                                        Text("$day-${getDayName(day)}", style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                        "Year" -> {
                            LazyColumn {
                                items(uniqueYears) { year ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                onYearsChanged(
                                                    if (year in selectedYears) selectedYears - year
                                                    else selectedYears + year
                                                )
                                            }
                                            .padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        Checkbox(
                                            checked = year in selectedYears,
                                            onCheckedChange = { checked ->
                                                onYearsChanged(
                                                    if (checked) selectedYears + year
                                                    else selectedYears - year
                                                )
                                            }
                                        )
                                        Text("$year", style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                        "Category" -> {
                            LazyColumn {
                                items(uniqueCategories) { cat ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                onCategoriesChanged(
                                                    if (cat in selectedCategories) selectedCategories - cat
                                                    else selectedCategories + cat
                                                )
                                            }
                                            .padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        Checkbox(
                                            checked = cat in selectedCategories,
                                            onCheckedChange = { checked ->
                                                onCategoriesChanged(
                                                    if (checked) selectedCategories + cat
                                                    else selectedCategories - cat
                                                )
                                            }
                                        )
                                        Text(cat, style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                        "Source" -> {
                            LazyColumn {
                                items(uniqueSources) { src ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                onSourcesChanged(
                                                    if (src in selectedSources) selectedSources - src
                                                    else selectedSources + src
                                                )
                                            }
                                            .padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        Checkbox(
                                            checked = src in selectedSources,
                                            onCheckedChange = { checked ->
                                                onSourcesChanged(
                                                    if (checked) selectedSources + src
                                                    else selectedSources - src
                                                )
                                            }
                                        )
                                        Text(src, style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Done")
            }
        }
    )
}

@Composable
fun TransactionItem(
    transaction: TransactionEntity,
    onDelete: () -> Unit
) {
    var showDeleteDialog by remember { mutableStateOf(false) }

    if (showDeleteDialog) {
        DeleteConfirmationDialog(
            title = "Delete Transaction",
            message = "Are you sure you want to delete this transaction?",
            onConfirm = {
                onDelete()
                showDeleteDialog = false
            },
            onDismiss = { showDeleteDialog = false }
        )
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = transaction.description.ifBlank { transaction.category },
                    style = MaterialTheme.typography.bodyLarge
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = transaction.category,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (transaction.source.isNotBlank()) {
                        Text(
                            text = "| ${transaction.source}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Text(
                    text = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(transaction.date)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = if (transaction.type == "Income") "+\u20B9${formatIndian(transaction.amount)}"
                    else "-\u20B9${formatIndian(transaction.amount)}",
                    style = MaterialTheme.typography.titleMedium,
                    color = if (transaction.type == "Income") MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.error
                )
                IconButton(onClick = { showDeleteDialog = true }) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Delete",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddTransactionDialog(
    categories: List<String>,
    sources: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (TransactionEntity) -> Unit
) {
    var type by remember { mutableStateOf("Expense") }
    var amount by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var source by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    val today = Calendar.getInstance()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Transaction") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("Expense", "Income").forEach { option ->
                        FilterChip(
                            selected = type == option,
                            onClick = { type = option },
                            label = { Text(option) }
                        )
                    }
                }

                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("Amount *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                if (type == "Expense") {
                    Column {
                        Text("Category *", style = MaterialTheme.typography.bodyMedium)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            categories.forEach { cat ->
                                FilterChip(
                                    selected = category == cat,
                                    onClick = { category = cat },
                                    label = { Text(cat, style = MaterialTheme.typography.labelSmall) }
                                )
                            }
                        }
                    }
                }

                Column {
                    Text("Source *", style = MaterialTheme.typography.bodyMedium)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        sources.forEach { src ->
                            FilterChip(
                                selected = source == src,
                                onClick = { source = src },
                                label = { Text(src, style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val amountValue = amount.toDoubleOrNull()
                    if (amountValue != null && amountValue > 0) {
                        val categoryValue = if (type == "Income") "Income" else category
                        if (categoryValue.isNotBlank() && source.isNotBlank()) {
                            onConfirm(
                                TransactionEntity(
                                    type = type,
                                    amount = amountValue,
                                    category = categoryValue,
                                    source = source,
                                    description = description.trim(),
                                    date = today.timeInMillis
                                )
                            )
                        }
                    }
                },
                enabled = amount.toDoubleOrNull() != null &&
                        amount.toDoubleOrNull()!! > 0 &&
                        (type == "Income" || category.isNotBlank()) &&
                        source.isNotBlank()
            ) {
                Text("Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
