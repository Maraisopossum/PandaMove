package com.pandafit.feature.stats.model

enum class DeltaDirection { UP, DOWN, FLAT }

data class StatDelta(val direction: DeltaDirection, val label: String)

private const val FLAT_THRESHOLD_PCT = 1.0

/** Delta relatif (%) vs la période précédente équivalente. */
fun deltaPercent(current: Number, previous: Number): StatDelta {
    val c = current.toDouble()
    val p = previous.toDouble()
    if (p == 0.0) return if (c == 0.0) StatDelta(DeltaDirection.FLAT, "=") else StatDelta(DeltaDirection.UP, "↑ nouveau")
    val pct = (c - p) / p * 100
    return when {
        kotlin.math.abs(pct) < FLAT_THRESHOLD_PCT -> StatDelta(DeltaDirection.FLAT, "=")
        pct > 0 -> StatDelta(DeltaDirection.UP, "↑ ${"%.0f".format(pct)}%")
        else -> StatDelta(DeltaDirection.DOWN, "↓ ${"%.0f".format(-pct)}%")
    }
}

/** Delta absolu (entier) vs la période précédente équivalente, ex. séances "+3". */
fun deltaAbsoluteInt(current: Int, previous: Int, unit: String = ""): StatDelta {
    val diff = current - previous
    return when {
        diff == 0 -> StatDelta(DeltaDirection.FLAT, "=")
        diff > 0 -> StatDelta(DeltaDirection.UP, "↑ +$diff$unit")
        else -> StatDelta(DeltaDirection.DOWN, "↓ $diff$unit")
    }
}

/** Delta absolu (décimal) vs la période précédente équivalente, ex. allure "4 s/km". */
fun deltaAbsoluteDouble(current: Double, previous: Double, unit: String = "", decimals: Int = 1): StatDelta {
    val diff = current - previous
    val formatted = "%.${decimals}f".format(kotlin.math.abs(diff))
    return when {
        kotlin.math.abs(diff) < 0.05 -> StatDelta(DeltaDirection.FLAT, "=")
        diff > 0 -> StatDelta(DeltaDirection.UP, "↑ +$formatted$unit")
        else -> StatDelta(DeltaDirection.DOWN, "↓ $formatted$unit")
    }
}
