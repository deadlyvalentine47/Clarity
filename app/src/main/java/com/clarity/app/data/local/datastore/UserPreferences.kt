package com.clarity.app.data.local.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "user_preferences")

@Singleton
class UserPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private object Keys {
        val USERNAME = stringPreferencesKey("username")
        val THEME_NAME = stringPreferencesKey("theme_name")
        val SECTION_ORDER = stringPreferencesKey("section_order")
        val SECTION_ENABLED = stringPreferencesKey("section_enabled")
    }

    val username: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[Keys.USERNAME] ?: ""
    }

    val isFirstLaunch: Flow<Boolean> = context.dataStore.data.map { preferences ->
        preferences[Keys.USERNAME] == null
    }

    val themeName: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[Keys.THEME_NAME] ?: "Ocean"
    }

    val sectionOrder: Flow<List<String>> = context.dataStore.data.map { preferences ->
        preferences[Keys.SECTION_ORDER]?.split(",") ?: listOf("Tasks", "Events", "Habits")
    }

    val sectionEnabled: Flow<Set<String>> = context.dataStore.data.map { preferences ->
        preferences[Keys.SECTION_ENABLED]?.split(",")?.filter { it.isNotBlank() }?.toSet()
            ?: setOf("Tasks", "Events", "Habits")
    }

    suspend fun setSectionOrder(order: List<String>) {
        context.dataStore.edit { preferences ->
            preferences[Keys.SECTION_ORDER] = order.joinToString(",")
        }
    }

    suspend fun setSectionEnabled(enabled: Set<String>) {
        context.dataStore.edit { preferences ->
            preferences[Keys.SECTION_ENABLED] = enabled.joinToString(",")
        }
    }

    suspend fun setUsername(name: String) {
        context.dataStore.edit { preferences ->
            preferences[Keys.USERNAME] = name
        }
    }

    suspend fun setTheme(name: String) {
        context.dataStore.edit { preferences ->
            preferences[Keys.THEME_NAME] = name
        }
    }
}
