package com.clarity.app.data.local.database

import androidx.room.TypeConverter
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

class Converters {
    private val json = Json { ignoreUnknownKeys = true }

    @TypeConverter
    fun fromStringList(value: List<String>): String = json.encodeToString(value)

    @TypeConverter
    fun toStringList(value: String): List<String> = try {
        json.decodeFromString(value)
    } catch (e: Exception) {
        emptyList()
    }

    @TypeConverter
    fun fromStringSet(value: Set<String>): String = json.encodeToString(value)

    @TypeConverter
    fun toStringSet(value: String): Set<String> = try {
        json.decodeFromString(value)
    } catch (e: Exception) {
        emptySet()
    }

    @TypeConverter
    fun fromIntList(value: List<Int>): String = json.encodeToString(value)

    @TypeConverter
    fun toIntList(value: String): List<Int> = try {
        json.decodeFromString(value)
    } catch (e: Exception) {
        emptyList()
    }

    @TypeConverter
    fun fromMap(value: Map<String, Boolean>): String = json.encodeToString(value)

    @TypeConverter
    fun toMap(value: String): Map<String, Boolean> = try {
        json.decodeFromString(value)
    } catch (e: Exception) {
        emptyMap()
    }

    @TypeConverter
    fun fromStringMap(value: Map<String, String>): String = json.encodeToString(value)

    @TypeConverter
    fun toStringMap(value: String): Map<String, String> = try {
        json.decodeFromString(value)
    } catch (e: Exception) {
        emptyMap()
    }
}
