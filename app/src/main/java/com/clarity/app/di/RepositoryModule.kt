package com.clarity.app.di

import com.clarity.app.data.repository.BudgetRepositoryImpl
import com.clarity.app.data.repository.EventRepositoryImpl
import com.clarity.app.data.repository.GoalRepositoryImpl
import com.clarity.app.data.repository.HabitRepositoryImpl
import com.clarity.app.data.repository.NoteRepositoryImpl
import com.clarity.app.data.repository.PomodoroRepositoryImpl
import com.clarity.app.data.repository.SubtaskRepositoryImpl
import com.clarity.app.data.repository.TaskRepositoryImpl
import com.clarity.app.data.repository.TransactionRepositoryImpl
import com.clarity.app.domain.repository.BudgetRepository
import com.clarity.app.domain.repository.EventRepository
import com.clarity.app.domain.repository.GoalRepository
import com.clarity.app.domain.repository.HabitRepository
import com.clarity.app.domain.repository.NoteRepository
import com.clarity.app.domain.repository.PomodoroRepository
import com.clarity.app.domain.repository.SubtaskRepository
import com.clarity.app.domain.repository.TaskRepository
import com.clarity.app.domain.repository.TransactionRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds @Singleton abstract fun bindTaskRepository(impl: TaskRepositoryImpl): TaskRepository
    @Binds @Singleton abstract fun bindHabitRepository(impl: HabitRepositoryImpl): HabitRepository
    @Binds @Singleton abstract fun bindTransactionRepository(impl: TransactionRepositoryImpl): TransactionRepository
    @Binds @Singleton abstract fun bindEventRepository(impl: EventRepositoryImpl): EventRepository
    @Binds @Singleton abstract fun bindNoteRepository(impl: NoteRepositoryImpl): NoteRepository
    @Binds @Singleton abstract fun bindGoalRepository(impl: GoalRepositoryImpl): GoalRepository
    @Binds @Singleton abstract fun bindSubtaskRepository(impl: SubtaskRepositoryImpl): SubtaskRepository
    @Binds @Singleton abstract fun bindBudgetRepository(impl: BudgetRepositoryImpl): BudgetRepository
    @Binds @Singleton abstract fun bindPomodoroRepository(impl: PomodoroRepositoryImpl): PomodoroRepository
}
