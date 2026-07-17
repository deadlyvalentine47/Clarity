package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import com.clarity.app.domain.repository.BudgetRepository
import com.clarity.app.domain.repository.CreditCardRepository
import com.clarity.app.domain.repository.InvestmentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.first
import java.time.YearMonth
import java.time.ZoneId
import javax.inject.Inject

data class MetricsData(
    val income: Double,
    val expenses: Double,
    val net: Double,
    val incomeBySource: List<Pair<String, Double>>,
    val expensesBySource: List<Pair<String, Double>>,
    val categorySpending: List<Pair<String, Double>>,
    val cardSpending: List<Pair<String, Double>>,
    val totalInvested: Double,
    val totalCurrent: Double,
    val profitLoss: Double
)

@HiltViewModel
class MetricsViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository,
    private val creditCardRepository: CreditCardRepository,
    private val investmentRepository: InvestmentRepository
) : ViewModel() {

    suspend fun loadMetrics(year: Int, month: Int): MetricsData {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val end = ym.atEndOfMonth().atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

        val allTxns = budgetRepository.getAllTransactions().first()
        val cards = creditCardRepository.getAllCards().first()
        val investments = investmentRepository.getAllInvestments().first()

        val monthTxns = allTxns.filter { it.date in start..end }

        val income = monthTxns.filter { it.type == "Income" }.sumOf { it.amount }
        val expenses = monthTxns.filter { it.type == "Expense" }.sumOf { it.amount }

        val incomeBySource = monthTxns.filter { it.type == "Income" }
            .groupBy { it.source }
            .map { (src, txs) -> src to txs.sumOf { it.amount } }
            .sortedByDescending { it.second }

        val expensesBySource = monthTxns.filter { it.type == "Expense" }
            .groupBy { it.source }
            .map { (src, txs) -> src to txs.sumOf { it.amount } }
            .sortedByDescending { it.second }

        val categorySpending = monthTxns.filter { it.type == "Expense" }
            .groupBy { it.category }
            .map { (cat, txs) -> cat to txs.sumOf { it.amount } }
            .sortedByDescending { it.second }

        val cardSpending = mutableListOf<Pair<String, Double>>()
        for (card in cards) {
            val txns = creditCardRepository.getTransactionsForCardInRange(card.id, start, end).first()
            val spends = txns.filter { it.type == "Purchase" }.sumOf { it.amount }
            cardSpending.add(card.name to spends)
        }

        val totalInvested = investments.sumOf { it.units * it.purchasePrice }
        val totalCurrent = investments.sumOf { it.units * it.currentPrice }

        return MetricsData(
            income = income,
            expenses = expenses,
            net = income - expenses,
            incomeBySource = incomeBySource,
            expensesBySource = expensesBySource,
            categorySpending = categorySpending,
            cardSpending = cardSpending,
            totalInvested = totalInvested,
            totalCurrent = totalCurrent,
            profitLoss = totalCurrent - totalInvested
        )
    }
}
