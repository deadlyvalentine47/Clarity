package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.CategoryEntity
import com.clarity.app.data.local.database.SourceEntity
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.domain.repository.BudgetRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import javax.inject.Inject

@HiltViewModel
class IncomeViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository
) : ViewModel() {

    val allTransactions: StateFlow<List<TransactionEntity>> = budgetRepository.getAllTransactions()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val sources: StateFlow<List<SourceEntity>> = budgetRepository.getSources()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val categories: StateFlow<List<CategoryEntity>> = budgetRepository.getCategories()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val incomeTransactions: StateFlow<List<TransactionEntity>> = allTransactions.map { list ->
        list.filter { it.type == "Income" }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun getMonthIncome(year: Int, month: Int): Double {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return allTransactions.value
            .filter { it.type == "Income" && it.date in start..end }
            .sumOf { it.amount }
    }

    fun getDailyIncome(year: Int, month: Int): List<Pair<Int, Double>> {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return allTransactions.value
            .filter { it.type == "Income" && it.date in start..end }
            .groupBy {
                val cal = java.util.Calendar.getInstance()
                cal.timeInMillis = it.date
                cal.get(java.util.Calendar.DAY_OF_MONTH)
            }
            .map { (day, txs) -> day to txs.sumOf { it.amount } }
            .sortedBy { it.first }
    }

    fun getIncomeBySource(year: Int, month: Int): List<Pair<String, Double>> {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return allTransactions.value
            .filter { it.type == "Income" && it.date in start..end }
            .groupBy { it.source.ifBlank { "Unknown" } }
            .map { (src, txs) -> src to txs.sumOf { it.amount } }
            .sortedByDescending { it.second }
    }

    fun addIncome(amount: Double, source: String, category: String, description: String) {
        viewModelScope.launch {
            budgetRepository.insertTransaction(
                TransactionEntity(
                    type = "Income",
                    amount = amount,
                    category = category,
                    source = source,
                    description = description.trim(),
                    date = System.currentTimeMillis()
                )
            )
            val src = budgetRepository.getSourceByName(source)
            if (src != null) {
                budgetRepository.updateSource(src.copy(balance = src.balance + amount))
            }
        }
    }

    fun deleteIncome(transaction: TransactionEntity) {
        viewModelScope.launch {
            budgetRepository.deleteTransaction(transaction)
            val src = budgetRepository.getSourceByName(transaction.source)
            if (src != null) {
                budgetRepository.updateSource(src.copy(balance = src.balance - transaction.amount))
            }
        }
    }

    fun addSource(name: String) {
        viewModelScope.launch {
            budgetRepository.insertSource(SourceEntity(name = name))
        }
    }

    fun addCategory(name: String) {
        viewModelScope.launch {
            budgetRepository.insertCategory(CategoryEntity(name = name))
        }
    }

    fun deleteSource(name: String) {
        viewModelScope.launch {
            val src = budgetRepository.getSourceByName(name)
            if (src != null) {
                budgetRepository.deleteSource(src)
            }
        }
    }

    fun deleteCategory(name: String) {
        viewModelScope.launch {
            val category = categories.value.find { it.name == name }
            if (category != null) {
                budgetRepository.deleteCategory(category)
            }
        }
    }
}
