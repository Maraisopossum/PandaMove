package com.pandafit.core.database.activityimport

import java.time.Instant
import java.time.format.DateTimeParseException

/** Parse un timestamp ISO 8601 (ex. "2026-07-10T08:15:32.000Z") en epoch millis, ou null si invalide. */
internal fun parseIsoInstantMs(value: String): Long? =
    if (value.isBlank()) null
    else try { Instant.parse(value).toEpochMilli() } catch (e: DateTimeParseException) { null }
