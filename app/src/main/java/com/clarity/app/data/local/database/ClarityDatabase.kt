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
        NoteCategoryEntity::class,
        CreditCardEntity::class,
        CreditCardTransactionEntity::class,
        InvestmentEntity::class
    ],
    version = 13,
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
    abstract fun creditCardDao(): CreditCardDao
    abstract fun creditCardTransactionDao(): CreditCardTransactionDao
    abstract fun investmentDao(): InvestmentDao

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

        val MIGRATION_10_11 = Migration(10, 11) { db ->
            db.execSQL(
                """CREATE TABLE IF NOT EXISTS `credit_cards` (
                    `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    `name` TEXT NOT NULL,
                    `creditLimit` REAL NOT NULL,
                    `billingCycleDay` INTEGER NOT NULL,
                    `createdAt` INTEGER NOT NULL
                )"""
            )
            db.execSQL(
                """CREATE TABLE IF NOT EXISTS `credit_card_transactions` (
                    `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    `cardId` INTEGER NOT NULL,
                    `amount` REAL NOT NULL,
                    `description` TEXT NOT NULL DEFAULT '',
                    `date` INTEGER NOT NULL,
                    `type` TEXT NOT NULL,
                    `createdAt` INTEGER NOT NULL
                )"""
            )
            db.execSQL(
                """CREATE TABLE IF NOT EXISTS `investments` (
                    `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    `name` TEXT NOT NULL,
                    `type` TEXT NOT NULL,
                    `units` REAL NOT NULL,
                    `purchasePrice` REAL NOT NULL,
                    `currentPrice` REAL NOT NULL,
                    `purchaseDate` INTEGER NOT NULL,
                    `notes` TEXT NOT NULL DEFAULT '',
                    `createdAt` INTEGER NOT NULL
                )"""
            )
        }

        val MIGRATION_11_12 = Migration(11, 12) { db ->
            db.execSQL("ALTER TABLE sources ADD COLUMN balance REAL NOT NULL DEFAULT 0.0")
        }

        val MIGRATION_12_13 = Migration(12, 13) { db ->
            db.execSQL("ALTER TABLE habits ADD COLUMN isDeleted INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE habits ADD COLUMN deletedAt INTEGER DEFAULT NULL")
        }

        fun create(context: Context): ClarityDatabase {
            return Room.databaseBuilder(
                context.applicationContext,
                ClarityDatabase::class.java,
                DATABASE_NAME
            )
                .addMigrations(MIGRATION_6_7, MIGRATION_7_8, MIGRATION_8_9, MIGRATION_9_10, MIGRATION_10_11, MIGRATION_11_12, MIGRATION_12_13)
                .fallbackToDestructiveMigration()
                .addCallback(DatabaseCallback())
                .build()
        }
    }
}
