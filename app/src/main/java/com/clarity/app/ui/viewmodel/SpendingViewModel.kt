package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.CategoryEntity
import com.clarity.app.data.local.database.CreditCardTransactionEntity
import com.clarity.app.data.local.database.SourceEntity
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.domain.repository.BudgetRepository
import com.clarity.app.domain.repository.CreditCardRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.YearMonth
import java.time.ZoneId
import javax.inject.Inject

@HiltViewModel
class SpendingViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository,
    private val creditCardRepository: CreditCardRepository
) : ViewModel() {

    val allTransactions: StateFlow<List<TransactionEntity>> = budgetRepository.getAllTransactions()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val categories: StateFlow<List<CategoryEntity>> = budgetRepository.getCategories()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val sources: StateFlow<List<SourceEntity>> = budgetRepository.getSources()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val expenseTransactions: StateFlow<List<TransactionEntity>> = allTransactions.map { list ->
        list.filter { it.type == "Expense" }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val creditCards = creditCardRepository.getAllCards()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun getMonthExpenses(year: Int, month: Int): Double {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return allTransactions.value
            .filter { it.type == "Expense" && it.date in start..end }
            .sumOf { it.amount }
    }

    fun getDailyExpenses(year: Int, month: Int): List<Pair<Int, Double>> {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return allTransactions.value
            .filter { it.type == "Expense" && it.date in start..end }
            .groupBy {
                val cal = java.util.Calendar.getInstance()
                cal.timeInMillis = it.date
                cal.get(java.util.Calendar.DAY_OF_MONTH)
            }
            .map { (day, txs) -> day to txs.sumOf { it.amount } }
            .sortedBy { it.first }
    }

    fun getCategorySpending(year: Int, month: Int): List<Pair<String, Double>> {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return allTransactions.value
            .filter { it.type == "Expense" && it.date in start..end }
            .groupBy { it.category }
            .map { (cat, txs) -> cat to txs.sumOf { it.amount } }
            .sortedByDescending { it.second }
    }

    fun addExpense(
        amount: Double,
        category: String,
        source: String,
        description: String,
        isCreditBillPayment: Boolean = false,
        creditCardName: String? = null
    ) {
        viewModelScope.launch {
            val finalCategory = if (isCreditBillPayment && creditCardName != null) {
                "${creditCardName}_BILL_PAYMENT"
            } else {
                category
            }

            budgetRepository.insertTransaction(
                TransactionEntity(
                    type = "Expense",
                    amount = amount,
                    category = finalCategory,
                    source = source,
                    description = description.trim(),
                    date = System.currentTimeMillis()
                )
            )

            val src = budgetRepository.getSourceByName(source)
            if (src != null) {
                budgetRepository.updateSource(src.copy(balance = src.balance - amount))
            }

            if (isCreditBillPayment && creditCardName != null) {
                val card = creditCardRepository.getCardByName(creditCardName)
                if (card != null) {
                    creditCardRepository.insertTransaction(
                        CreditCardTransactionEntity(
                            cardId = card.id,
                            amount = amount,
                            description = "Bill Payment - $description",
                            date = System.currentTimeMillis(),
                            type = "Payment"
                        )
                    )
                }
            }
        }
    }

    fun deleteExpense(transaction: TransactionEntity) {
        viewModelScope.launch {
            budgetRepository.deleteTransaction(transaction)
            val src = budgetRepository.getSourceByName(transaction.source)
            if (src != null) {
                budgetRepository.updateSource(src.copy(balance = src.balance + transaction.amount))
            }
        }
    }

    fun addCategory(name: String) {
        viewModelScope.launch {
            budgetRepository.insertCategory(CategoryEntity(name = name))
        }
    }

    fun addSource(name: String) {
        viewModelScope.launch {
            budgetRepository.insertSource(SourceEntity(name = name))
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
