package com.clarity.app.data.local.database

import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class DatabaseCallback : RoomDatabase.Callback() {
    override fun onCreate(db: SupportSQLiteDatabase) {
        super.onCreate(db)
        CoroutineScope(Dispatchers.IO).launch {
            val defaultCategories = listOf("Food", "Transport", "Travel")
            defaultCategories.forEach { name ->
                db.execSQL(
                    "INSERT INTO categories (name, isDefault, createdAt) VALUES (?, 1, ?)",
                    arrayOf<Any>(name, System.currentTimeMillis())
                )
            }

            val defaultSources = listOf("Bank Account", "Credit Card")
            defaultSources.forEach { name ->
                db.execSQL(
                    "INSERT INTO sources (name, isDefault, createdAt) VALUES (?, 1, ?)",
                    arrayOf<Any>(name, System.currentTimeMillis())
                )
            }
        }
    }
}
