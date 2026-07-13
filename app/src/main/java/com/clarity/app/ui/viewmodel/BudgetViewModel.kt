package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.BudgetLimitEntity
import com.clarity.app.data.local.database.CategoryEntity
import com.clarity.app.data.local.database.SourceEntity
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.domain.repository.BudgetRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

@HiltViewModel
class BudgetViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository
) : ViewModel() {

    val transactions: StateFlow<List<TransactionEntity>> = budgetRepository.getAllTransactions()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val categories: StateFlow<List<CategoryEntity>> = budgetRepository.getCategories()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val sources: StateFlow<List<SourceEntity>> = budgetRepository.getSources()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val totalIncome: StateFlow<Double> = budgetRepository.getTotalIncome()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = 0.0
        )

    val totalExpenses: StateFlow<Double> = budgetRepository.getTotalExpenses()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = 0.0
        )

    val balance: StateFlow<Double> = budgetRepository.getTotalIncome()
        .combine(budgetRepository.getTotalExpenses()) { income, expenses ->
            (income ?: 0.0) - (expenses ?: 0.0)
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = 0.0
        )

    private val now = LocalDate.now()
    val budgetLimits: StateFlow<List<BudgetLimitEntity>> = budgetRepository.getBudgetLimitsForMonth(
        now.monthValue, now.year
    ).stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    fun addTransaction(transaction: TransactionEntity) {
        viewModelScope.launch {
            budgetRepository.insertTransaction(transaction)
        }
    }

    fun deleteTransaction(transaction: TransactionEntity) {
        viewModelScope.launch {
            budgetRepository.deleteTransaction(transaction)
        }
    }

    fun addBudgetLimit(budgetLimit: BudgetLimitEntity) {
        viewModelScope.launch {
            budgetRepository.insertBudgetLimit(budgetLimit)
        }
    }

    fun updateBudgetLimit(budgetLimit: BudgetLimitEntity) {
        viewModelScope.launch {
            budgetRepository.updateBudgetLimit(budgetLimit)
        }
    }

    fun deleteBudgetLimit(budgetLimit: BudgetLimitEntity) {
        viewModelScope.launch {
            budgetRepository.deleteBudgetLimit(budgetLimit)
        }
    }

    fun addCategory(name: String, isDefault: Boolean = false) {
        viewModelScope.launch {
            budgetRepository.insertCategory(CategoryEntity(name = name, isDefault = isDefault))
        }
    }

    fun deleteCategory(category: CategoryEntity) {
        viewModelScope.launch {
            budgetRepository.deleteCategory(category)
        }
    }

    fun addSource(name: String, isDefault: Boolean = false) {
        viewModelScope.launch {
            budgetRepository.insertSource(SourceEntity(name = name, isDefault = isDefault))
        }
    }

    fun deleteSource(source: SourceEntity) {
        viewModelScope.launch {
            budgetRepository.deleteSource(source)
        }
    }

    fun getMonthTransactions(): List<TransactionEntity> {
        val startOfMonth = now.withDayOfMonth(1)
            .atStartOfDay(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
        val endOfMonth = now.withDayOfMonth(now.lengthOfMonth())
            .atTime(23, 59, 59)
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()

        return transactions.value.filter { it.date in startOfMonth..endOfMonth }
    }

    fun getCategorySpending(category: String): Double {
        return transactions.value
            .filter { it.type == "Expense" && it.category == category }
            .sumOf { it.amount }
    }

    fun getSourceSpending(source: String): Double {
        return transactions.value
            .filter { it.type == "Expense" && it.source == source }
            .sumOf { it.amount }
    }
}
