package com.clarity.app.ui.screens.budget

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ManageSourcesCategoriesDialog(
    sources: List<String>,
    categories: List<String>,
    onAddSource: (String) -> Unit,
    onDeleteSource: (String) -> Unit,
    onAddCategory: (String) -> Unit,
    onDeleteCategory: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var newSource by remember { mutableStateOf("") }
    var newCategory by remember { mutableStateOf("") }
    var sourcesExpanded by remember { mutableStateOf(true) }
    var categoriesExpanded by remember { mutableStateOf(true) }
    var sourceSearchQuery by remember { mutableStateOf("") }
    var categorySearchQuery by remember { mutableStateOf("") }
    var deleteTarget by remember { mutableStateOf<Pair<String, Boolean>?>(null) }

    val filteredSources = remember(sources, sourceSearchQuery) {
        if (sourceSearchQuery.isBlank()) sources
        else sources.filter { it.contains(sourceSearchQuery, ignoreCase = true) }
    }
    val filteredCategories = remember(categories, categorySearchQuery) {
        if (categorySearchQuery.isBlank()) categories
        else categories.filter { it.contains(categorySearchQuery, ignoreCase = true) }
    }

    if (deleteTarget != null) {
        val (name, isSource) = deleteTarget!!
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete ${if (isSource) "Bank Account" else "Category"}") },
            text = { Text("Are you sure you want to delete \"$name\"?") },
            confirmButton = {
                TextButton(onClick = {
                    if (isSource) onDeleteSource(name) else onDeleteCategory(name)
                    deleteTarget = null
                }) { Text("Yes", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("No") }
            }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Manage Sources & Categories") },
        text = {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().clickable { sourcesExpanded = !sourcesExpanded }.padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Bank Accounts (Sources)", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                        Icon(
                            if (sourcesExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                            contentDescription = if (sourcesExpanded) "Collapse" else "Expand"
                        )
                    }
                }

                item {
                    AnimatedVisibility(visible = sourcesExpanded) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                OutlinedTextField(
                                    value = newSource,
                                    onValueChange = { newSource = it },
                                    label = { Text("New bank name") },
                                    modifier = Modifier.weight(1f),
                                    singleLine = true
                                )
                                IconButton(onClick = {
                                    if (newSource.isNotBlank()) {
                                        onAddSource(newSource.trim())
                                        newSource = ""
                                    }
                                }) {
                                    Icon(Icons.Default.Add, contentDescription = "Add Source")
                                }
                            }

                            if (sources.size > 3) {
                                OutlinedTextField(
                                    value = sourceSearchQuery,
                                    onValueChange = { sourceSearchQuery = it },
                                    label = { Text("Search sources") },
                                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                            }

                            filteredSources.forEach { source ->
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(source, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                                    IconButton(onClick = { deleteTarget = source to true }) {
                                        Icon(Icons.Default.Close, contentDescription = "Delete $source", tint = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }
                        }
                    }
                }

                item { HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp)) }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().clickable { categoriesExpanded = !categoriesExpanded }.padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Categories", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                        Icon(
                            if (categoriesExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                            contentDescription = if (categoriesExpanded) "Collapse" else "Expand"
                        )
                    }
                }

                item {
                    AnimatedVisibility(visible = categoriesExpanded) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                OutlinedTextField(
                                    value = newCategory,
                                    onValueChange = { newCategory = it },
                                    label = { Text("New category name") },
                                    modifier = Modifier.weight(1f),
                                    singleLine = true
                                )
                                IconButton(onClick = {
                                    if (newCategory.isNotBlank()) {
                                        onAddCategory(newCategory.trim())
                                        newCategory = ""
                                    }
                                }) {
                                    Icon(Icons.Default.Add, contentDescription = "Add Category")
                                }
                            }

                            if (categories.size > 3) {
                                OutlinedTextField(
                                    value = categorySearchQuery,
                                    onValueChange = { categorySearchQuery = it },
                                    label = { Text("Search categories") },
                                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                            }

                            filteredCategories.forEach { category ->
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(category, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                                    IconButton(onClick = { deleteTarget = category to false }) {
                                        Icon(Icons.Default.Close, contentDescription = "Delete $category", tint = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Done") }
        }
    )
}
