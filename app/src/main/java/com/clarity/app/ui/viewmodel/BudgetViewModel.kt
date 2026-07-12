package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.BudgetLimitEntity
import com.clarity.app.data.local.database.CategoryEntity
import com.clarity.app.data.local.database.SourceEntity
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.data.local.database.BudgetLimitDao
import com.clarity.app.data.local.database.CategoryDao
import com.clarity.app.data.local.database.SourceDao
import com.clarity.app.domain.repository.TransactionRepository
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
    private val transactionRepository: TransactionRepository,
    private val budgetLimitDao: BudgetLimitDao,
    private val categoryDao: CategoryDao,
    private val sourceDao: SourceDao
) : ViewModel() {

    val transactions: StateFlow<List<TransactionEntity>> = transactionRepository.getAllTransactions()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val categories: StateFlow<List<CategoryEntity>> = categoryDao.getAllCategories()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val sources: StateFlow<List<SourceEntity>> = sourceDao.getAllSources()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val totalIncome: StateFlow<Double> = transactionRepository.getTotalIncome()
        .combine(transactionRepository.getTotalExpenses()) { income, _ ->
            (income ?: 0.0)
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = 0.0
        )

    val totalExpenses: StateFlow<Double> = transactionRepository.getTotalExpenses()
        .combine(transactionRepository.getTotalIncome()) { expenses, _ ->
            (expenses ?: 0.0)
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = 0.0
        )

    val balance: StateFlow<Double> = combine(
        transactionRepository.getTotalIncome(),
        transactionRepository.getTotalExpenses()
    ) { income, expenses ->
        (income ?: 0.0) - (expenses ?: 0.0)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = 0.0
    )

    private val now = LocalDate.now()
    val budgetLimits: StateFlow<List<BudgetLimitEntity>> = budgetLimitDao.getBudgetLimitsForMonth(
        now.monthValue, now.year
    ).stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    fun addTransaction(transaction: TransactionEntity) {
        viewModelScope.launch {
            transactionRepository.insertTransaction(transaction)
        }
    }

    fun deleteTransaction(transaction: TransactionEntity) {
        viewModelScope.launch {
            transactionRepository.deleteTransaction(transaction)
        }
    }

    fun addBudgetLimit(budgetLimit: BudgetLimitEntity) {
        viewModelScope.launch {
            budgetLimitDao.insertBudgetLimit(budgetLimit)
        }
    }

    fun updateBudgetLimit(budgetLimit: BudgetLimitEntity) {
        viewModelScope.launch {
            budgetLimitDao.updateBudgetLimit(budgetLimit)
        }
    }

    fun deleteBudgetLimit(budgetLimit: BudgetLimitEntity) {
        viewModelScope.launch {
            budgetLimitDao.deleteBudgetLimit(budgetLimit)
        }
    }

    fun addCategory(name: String, isDefault: Boolean = false) {
        viewModelScope.launch {
            categoryDao.insertCategory(CategoryEntity(name = name, isDefault = isDefault))
        }
    }

    fun deleteCategory(category: CategoryEntity) {
        viewModelScope.launch {
            categoryDao.deleteCategory(category)
        }
    }

    fun addSource(name: String, isDefault: Boolean = false) {
        viewModelScope.launch {
            sourceDao.insertSource(SourceEntity(name = name, isDefault = isDefault))
        }
    }

    fun deleteSource(source: SourceEntity) {
        viewModelScope.launch {
            sourceDao.deleteSource(source)
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
