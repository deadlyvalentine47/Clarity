package com.clarity.app.di

import android.content.Context
import com.clarity.app.data.local.database.BudgetLimitDao
import com.clarity.app.data.local.database.CategoryDao
import com.clarity.app.data.local.database.ClarityDatabase
import com.clarity.app.data.local.database.CreditCardDao
import com.clarity.app.data.local.database.CreditCardTransactionDao
import com.clarity.app.data.local.database.DayJournalDao
import com.clarity.app.data.local.database.EventDao
import com.clarity.app.data.local.database.GoalDao
import com.clarity.app.data.local.database.HabitDao
import com.clarity.app.data.local.database.InvestmentDao
import com.clarity.app.data.local.database.NoteCategoryDao
import com.clarity.app.data.local.database.NoteDao
import com.clarity.app.data.local.database.PomodoroFocusSessionDao
import com.clarity.app.data.local.database.PomodoroSessionDao
import com.clarity.app.data.local.database.SourceDao
import com.clarity.app.data.local.database.SubtaskDao
import com.clarity.app.data.local.database.TaskDao
import com.clarity.app.data.local.database.TransactionDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): ClarityDatabase {
        return ClarityDatabase.create(context)
    }

    @Provides
    fun provideTaskDao(database: ClarityDatabase): TaskDao = database.taskDao()

    @Provides
    fun provideHabitDao(database: ClarityDatabase): HabitDao = database.habitDao()

    @Provides
    fun provideNoteDao(database: ClarityDatabase): NoteDao = database.noteDao()

    @Provides
    fun provideTransactionDao(database: ClarityDatabase): TransactionDao = database.transactionDao()

    @Provides
    fun provideGoalDao(database: ClarityDatabase): GoalDao = database.goalDao()

    @Provides
    fun provideEventDao(database: ClarityDatabase): EventDao = database.eventDao()

    @Provides
    fun providePomodoroSessionDao(database: ClarityDatabase): PomodoroSessionDao = database.pomodoroSessionDao()

    @Provides
    fun providePomodoroFocusSessionDao(database: ClarityDatabase): PomodoroFocusSessionDao = database.pomodoroFocusSessionDao()

    @Provides
    fun provideSubtaskDao(database: ClarityDatabase): SubtaskDao = database.subtaskDao()

    @Provides
    fun provideBudgetLimitDao(database: ClarityDatabase): BudgetLimitDao = database.budgetLimitDao()

    @Provides
    fun provideCategoryDao(database: ClarityDatabase): CategoryDao = database.categoryDao()

    @Provides
    fun provideSourceDao(database: ClarityDatabase): SourceDao = database.sourceDao()

    @Provides
    fun provideNoteCategoryDao(database: ClarityDatabase): NoteCategoryDao = database.noteCategoryDao()

    @Provides
    fun provideCreditCardDao(database: ClarityDatabase): CreditCardDao = database.creditCardDao()

    @Provides
    fun provideCreditCardTransactionDao(database: ClarityDatabase): CreditCardTransactionDao = database.creditCardTransactionDao()

    @Provides
    fun provideInvestmentDao(database: ClarityDatabase): InvestmentDao = database.investmentDao()

    @Provides
    fun provideDayJournalDao(database: ClarityDatabase): DayJournalDao = database.dayJournalDao()
}
