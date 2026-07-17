package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.InvestmentEntity
import com.clarity.app.domain.repository.InvestmentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import javax.inject.Inject

data class InvestmentSummary(
    val totalInvested: Double,
    val totalCurrentValue: Double,
    val totalProfitLoss: Double,
    val profitLossPercent: Double
)

data class TypeAllocation(
    val type: String,
    val totalInvested: Double,
    val totalCurrentValue: Double
)

@HiltViewModel
class InvestmentViewModel @Inject constructor(
    private val investmentRepository: InvestmentRepository
) : ViewModel() {

    val investments: StateFlow<List<InvestmentEntity>> = investmentRepository.getAllInvestments()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val summary: StateFlow<InvestmentSummary> = investments.map { list ->
        val totalInvested = list.sumOf { it.units * it.purchasePrice }
        val totalCurrentValue = list.sumOf { it.units * it.currentPrice }
        val profitLoss = totalCurrentValue - totalInvested
        val profitLossPercent = if (totalInvested > 0) (profitLoss / totalInvested) * 100 else 0.0
        InvestmentSummary(
            totalInvested = totalInvested,
            totalCurrentValue = totalCurrentValue,
            totalProfitLoss = profitLoss,
            profitLossPercent = profitLossPercent
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), InvestmentSummary(0.0, 0.0, 0.0, 0.0))

    val typeAllocation: StateFlow<List<TypeAllocation>> = investments.map { list ->
        list.groupBy { it.type }
            .map { (type, items) ->
                TypeAllocation(
                    type = type,
                    totalInvested = items.sumOf { it.units * it.purchasePrice },
                    totalCurrentValue = items.sumOf { it.units * it.currentPrice }
                )
            }
            .sortedByDescending { it.totalInvested }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val investmentTypes: List<String> = listOf(
        "Stock", "Mutual Fund", "ETF", "Crypto", "FD", "Bond", "Real Estate", "Gold", "Other"
    )

    fun addInvestment(
        name: String,
        type: String,
        units: Double,
        purchasePrice: Double,
        currentPrice: Double,
        purchaseDate: Long,
        notes: String
    ) {
        viewModelScope.launch {
            investmentRepository.insertInvestment(
                InvestmentEntity(
                    name = name,
                    type = type,
                    units = units,
                    purchasePrice = purchasePrice,
                    currentPrice = currentPrice,
                    purchaseDate = purchaseDate,
                    notes = notes
                )
            )
        }
    }

    fun updateInvestment(investment: InvestmentEntity) {
        viewModelScope.launch {
            investmentRepository.updateInvestment(investment)
        }
    }

    fun deleteInvestment(investment: InvestmentEntity) {
        viewModelScope.launch {
            investmentRepository.deleteInvestment(investment)
        }
    }
}
