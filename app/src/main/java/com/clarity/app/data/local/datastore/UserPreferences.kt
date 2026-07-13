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
