package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import com.clarity.app.data.local.database.CreditCardEntity
import com.clarity.app.data.local.database.InvestmentEntity
import com.clarity.app.data.local.database.SourceEntity
import com.clarity.app.data.local.database.TransactionEntity
import com.clarity.app.domain.repository.BudgetRepository
import com.clarity.app.domain.repository.CreditCardRepository
import com.clarity.app.domain.repository.InvestmentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import java.time.YearMonth
import java.time.ZoneId
import javax.inject.Inject

data class CardWithOutstanding(
    val card: CreditCardEntity,
    val outstanding: Double,
    val available: Double
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class BudgetMainViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository,
    private val creditCardRepository: CreditCardRepository,
    private val investmentRepository: InvestmentRepository
) : ViewModel() {

    val sources: StateFlow<List<SourceEntity>> = budgetRepository.getSources()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val balance: StateFlow<Double> = sources.map { list ->
        list.sumOf { it.balance }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val totalIncome: StateFlow<Double> = budgetRepository.getTotalIncome()
        .map { it ?: 0.0 }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val totalExpenses: StateFlow<Double> = budgetRepository.getTotalExpenses()
        .map { it ?: 0.0 }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val transactions: StateFlow<List<TransactionEntity>> = budgetRepository.getAllTransactions()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val creditCards: StateFlow<List<CreditCardEntity>> = creditCardRepository.getAllCards()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val cardsWithOutstanding: StateFlow<List<CardWithOutstanding>> = creditCards.flatMapLatest { cardList ->
        if (cardList.isEmpty()) {
            flowOf(emptyList())
        } else {
            val flows = cardList.map { card ->
                creditCardRepository.getOutstandingForCard(card.id)
                    .map { outstanding ->
                        val out = outstanding ?: 0.0
                        CardWithOutstanding(card, out, card.creditLimit - out)
                    }
            }
            combine(flows) { results -> results.toList() }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val investments: StateFlow<List<InvestmentEntity>> = investmentRepository.getAllInvestments()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun getMonthIncome(year: Int, month: Int): Double {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return transactions.value
            .filter { it.type == "Income" && it.date in start..end }
            .sumOf { it.amount }
    }

    fun getMonthExpenses(year: Int, month: Int): Double {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return transactions.value
            .filter { it.type == "Expense" && it.date in start..end }
            .sumOf { it.amount }
    }

    fun getDailyIncomeForMonth(year: Int, month: Int): List<Pair<Int, Double>> {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return transactions.value
            .filter { it.type == "Income" && it.date in start..end }
            .groupBy {
                val cal = java.util.Calendar.getInstance()
                cal.timeInMillis = it.date
                cal.get(java.util.Calendar.DAY_OF_MONTH)
            }
            .map { (day, txs) -> day to txs.sumOf { it.amount } }
            .sortedBy { it.first }
    }

    fun getDailyExpensesForMonth(year: Int, month: Int): List<Pair<Int, Double>> {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        return transactions.value
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
        return transactions.value
            .filter { it.type == "Expense" && it.date in start..end }
            .groupBy { it.category }
            .map { (cat, txs) -> cat to txs.sumOf { it.amount } }
            .sortedByDescending { it.second }
    }

    fun getInvestmentSummary(): Triple<Double, Double, Double> {
        val list = investments.value
        val totalInvested = list.sumOf { it.units * it.purchasePrice }
        val totalCurrent = list.sumOf { it.units * it.currentPrice }
        return Triple(totalInvested, totalCurrent, totalCurrent - totalInvested)
    }
}
