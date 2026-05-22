package com.pandafit.core.database.converters

import androidx.room.TypeConverter
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class ListConverters {

    private val json = Json { ignoreUnknownKeys = true }

    @TypeConverter
    fun fromStringList(value: String): List<String> =
        json.decodeFromString(value)

    @TypeConverter
    fun toStringList(list: List<String>): String =
        json.encodeToString(list)
}
