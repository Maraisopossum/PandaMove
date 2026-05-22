package com.pandafit.core.database.converters

import androidx.room.TypeConverter
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class DateConverters {

    private val dateFormatter = DateTimeFormatter.ISO_LOCAL_DATE
    private val dateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME

    @TypeConverter
    fun fromLocalDate(value: String?): LocalDate? =
        value?.let { LocalDate.parse(it, dateFormatter) }

    @TypeConverter
    fun toLocalDate(date: LocalDate?): String? =
        date?.format(dateFormatter)

    @TypeConverter
    fun fromLocalDateTime(value: String?): LocalDateTime? =
        value?.let { LocalDateTime.parse(it, dateTimeFormatter) }

    @TypeConverter
    fun toLocalDateTime(dateTime: LocalDateTime?): String? =
        dateTime?.format(dateTimeFormatter)
}
