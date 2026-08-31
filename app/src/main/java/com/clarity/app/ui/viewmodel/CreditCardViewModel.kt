package com.clarity.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clarity.app.data.local.database.CreditCardEntity
import com.clarity.app.data.local.database.CreditCardTransactionEntity
import com.clarity.app.domain.repository.CreditCardRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CardWithDetails(
    val card: CreditCardEntity,
    val outstanding: Double,
    val available: Double
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class CreditCardViewModel @Inject constructor(
    private val creditCardRepository: CreditCardRepository
) : ViewModel() {

    val cards: StateFlow<List<CreditCardEntity>> = creditCardRepository.getAllCards()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val cardsWithDetails: StateFlow<List<CardWithDetails>> = cards.flatMapLatest { cardList ->
        if (cardList.isEmpty()) {
            flowOf(emptyList())
        } else {
            val flows = cardList.map { card ->
                creditCardRepository.getOutstandingForCard(card.id)
                    .map { outstanding ->
                        val out = outstanding ?: 0.0
                        CardWithDetails(card, out, card.creditLimit - out)
                    }
            }
            combine(flows) { results -> results.toList() }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _selectedCardId = MutableStateFlow<Long?>(null)

    val selectedCardTransactions: StateFlow<List<CreditCardTransactionEntity>> = _selectedCardId
        .flatMapLatest { id ->
            if (id == null) flowOf(emptyList())
            else creditCardRepository.getTransactionsForCard(id)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun selectCard(cardId: Long) {
        _selectedCardId.value = cardId
    }

    fun addCard(name: String, creditLimit: Double, billingCycleDay: Int) {
        viewModelScope.launch {
            creditCardRepository.insertCard(
                CreditCardEntity(
                    name = name,
                    creditLimit = creditLimit,
                    billingCycleDay = billingCycleDay
                )
            )
        }
    }

    fun updateCard(card: CreditCardEntity) {
        viewModelScope.launch {
            creditCardRepository.updateCard(card)
        }
    }

    fun deleteCard(card: CreditCardEntity) {
        viewModelScope.launch {
            creditCardRepository.deleteCard(card)
        }
    }

    fun addPurchase(cardId: Long, amount: Double, description: String) {
        viewModelScope.launch {
            creditCardRepository.insertTransaction(
                CreditCardTransactionEntity(
                    cardId = cardId,
                    amount = amount,
                    description = description.trim(),
                    date = System.currentTimeMillis(),
                    type = "Purchase"
                )
            )
        }
    }

    fun addPayment(cardId: Long, amount: Double, description: String) {
        viewModelScope.launch {
            creditCardRepository.insertTransaction(
                CreditCardTransactionEntity(
                    cardId = cardId,
                    amount = amount,
                    description = description.trim(),
                    date = System.currentTimeMillis(),
                    type = "Payment"
                )
            )
        }
    }

    fun addCredit(cardId: Long, amount: Double, description: String) {
        viewModelScope.launch {
            creditCardRepository.insertTransaction(
                CreditCardTransactionEntity(
                    cardId = cardId,
                    amount = amount,
                    description = description.trim(),
                    date = System.currentTimeMillis(),
                    type = "Credit"
                )
            )
        }
    }

    fun deleteTransaction(transaction: CreditCardTransactionEntity) {
        viewModelScope.launch {
            creditCardRepository.deleteTransaction(transaction)
        }
    }
}
