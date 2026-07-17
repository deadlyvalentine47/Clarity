package com.clarity.app.data.local.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        TaskEntity::class,
        HabitEntity::class,
        NoteEntity::class,
        TransactionEntity::class,
        GoalEntity::class,
        EventEntity::class,
        PomodoroSessionEntity::class,
        PomodoroFocusSessionEntity::class,
        SubtaskEntity::class,
        BudgetLimitEntity::class,
        CategoryEntity::class,
        SourceEntity::class,
        NoteCategoryEntity::class
    ],
    version = 10,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class ClarityDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao
    abstract fun habitDao(): HabitDao
    abstract fun noteDao(): NoteDao
    abstract fun transactionDao(): TransactionDao
    abstract fun goalDao(): GoalDao
    abstract fun eventDao(): EventDao
    abstract fun pomodoroSessionDao(): PomodoroSessionDao
    abstract fun pomodoroFocusSessionDao(): PomodoroFocusSessionDao
    abstract fun subtaskDao(): SubtaskDao
    abstract fun budgetLimitDao(): BudgetLimitDao
    abstract fun categoryDao(): CategoryDao
    abstract fun sourceDao(): SourceDao
    abstract fun noteCategoryDao(): NoteCategoryDao

    companion object {
        const val DATABASE_NAME = "clarity.db"

        val MIGRATION_6_7 = Migration(6, 7) { db ->
            db.execSQL("ALTER TABLE habits ADD COLUMN alternateDays INTEGER DEFAULT NULL")
        }

        val MIGRATION_7_8 = Migration(7, 8) { db ->
            db.execSQL("ALTER TABLE habits ADD COLUMN selectedDays TEXT DEFAULT NULL")
        }

        val MIGRATION_8_9 = Migration(8, 9) { db ->
            db.execSQL("ALTER TABLE habits ADD COLUMN archivedAt INTEGER DEFAULT NULL")
        }

        val MIGRATION_9_10 = Migration(9, 10) { db ->
            db.execSQL("ALTER TABLE habits ADD COLUMN deadlineHour INTEGER DEFAULT NULL")
            db.execSQL("ALTER TABLE habits ADD COLUMN deadlineMinute INTEGER DEFAULT NULL")
        }

        fun create(context: Context): ClarityDatabase {
            return Room.databaseBuilder(
                context.applicationContext,
                ClarityDatabase::class.java,
                DATABASE_NAME
            )
                .addMigrations(MIGRATION_6_7, MIGRATION_7_8, MIGRATION_8_9, MIGRATION_9_10)
                .fallbackToDestructiveMigration()
                .addCallback(DatabaseCallback())
                .build()
        }
    }
}
