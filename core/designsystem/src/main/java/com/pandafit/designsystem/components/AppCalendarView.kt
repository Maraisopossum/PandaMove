package com.pandafit.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.pandafit.designsystem.theme.PandaBackground
import com.pandafit.designsystem.theme.PandaOutline
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaPurpleLight
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.designsystem.theme.PandaWhite
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

// ══════════════════════════════════════════════════════════════════════════════
// TYPES PUBLICS
// ══════════════════════════════════════════════════════════════════════════════

/** Un "point" de couleur sur un jour du calendrier (ex. une séance). */
data class CalendarDot(
    val color: Color,
    val label: String = "",
)

/** Données pour un jour affiché dans le calendrier. */
data class CalendarDayData(
    val dots: List<CalendarDot> = emptyList(),
    val isHighlighted: Boolean = false,   // ex. séance planifiée
)

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calendrier mensuel réutilisable — charte graphique PandaMove.
 *
 * - En-tête mois + navigation ← →
 * - Grille 7 colonnes (Lun → Dim)
 * - Aujourd'hui surligné en violet
 * - Jour sélectionné avec fond pill
 * - Points colorés sous chaque jour (max 3)
 *
 * ```kotlin
 * AppCalendarView(
 *     month = viewModel.currentMonth,
 *     selectedDate = viewModel.selectedDate,
 *     dayData = viewModel.calendarData,
 *     onDateSelected = viewModel::selectDate,
 *     onMonthChanged = viewModel::navigateMonth,
 * )
 * ```
 */
@Composable
fun AppCalendarView(
    month: YearMonth,
    selectedDate: LocalDate?,
    dayData: Map<LocalDate, CalendarDayData> = emptyMap(),
    accentColor: Color = PandaPurple,
    onDateSelected: (LocalDate) -> Unit = {},
    onMonthChanged: (YearMonth) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val today = LocalDate.now()
    val firstDay = month.atDay(1)
    // Lundi = 1 … Dimanche = 7 ; décalage pour commencer la grille le lundi
    val startOffset = (firstDay.dayOfWeek.value - 1).coerceAtLeast(0)
    val daysInMonth = month.lengthOfMonth()
    val weekDays = listOf("L", "M", "M", "J", "V", "S", "D")

    Column(modifier = modifier) {
        // ── En-tête mois ──────────────────────────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { onMonthChanged(month.minusMonths(1)) }) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Mois précédent", tint = PandaSubtext)
            }
            Text(
                text = "${month.month.getDisplayName(TextStyle.FULL, Locale.FRENCH).replaceFirstChar { it.uppercase() }} ${month.year}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
            )
            IconButton(onClick = { onMonthChanged(month.plusMonths(1)) }) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Mois suivant", tint = PandaSubtext)
            }
        }

        Spacer(Modifier.height(4.dp))

        // ── Jours de la semaine ───────────────────────────────────────────────
        Row(modifier = Modifier.fillMaxWidth()) {
            weekDays.forEach { d ->
                Text(
                    d,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = PandaSubtext,
                )
            }
        }
        Spacer(Modifier.height(4.dp))

        // ── Grille des jours ─────────────────────────────────────────────────
        val totalCells = startOffset + daysInMonth
        val rows = (totalCells + 6) / 7

        for (row in 0 until rows) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (col in 0 until 7) {
                    val cellIndex = row * 7 + col
                    val dayNumber = cellIndex - startOffset + 1

                    if (dayNumber < 1 || dayNumber > daysInMonth) {
                        Box(modifier = Modifier.weight(1f).aspectRatio(1f))
                    } else {
                        val date = month.atDay(dayNumber)
                        val isToday = date == today
                        val isSelected = date == selectedDate
                        val data = dayData[date]
                        CalendarDayCell(
                            day = dayNumber,
                            isToday = isToday,
                            isSelected = isSelected,
                            dots = data?.dots?.take(3) ?: emptyList(),
                            isHighlighted = data?.isHighlighted == true,
                            accentColor = accentColor,
                            onClick = { onDateSelected(date) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}

// ── Cellule jour ──────────────────────────────────────────────────────────────

@Composable
private fun CalendarDayCell(
    day: Int,
    isToday: Boolean,
    isSelected: Boolean,
    dots: List<CalendarDot>,
    isHighlighted: Boolean,
    accentColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .aspectRatio(0.85f)
            .clip(RoundedCornerShape(8.dp))
            .background(
                when {
                    isSelected -> accentColor
                    isToday    -> accentColor.copy(alpha = 0.1f)
                    else       -> Color.Transparent
                },
            )
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // Numéro du jour
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(28.dp),
        ) {
            Text(
                text = day.toString(),
                style = MaterialTheme.typography.bodySmall,
                fontWeight = when {
                    isSelected || isToday -> FontWeight.Bold
                    else                  -> FontWeight.Normal
                },
                color = when {
                    isSelected -> PandaWhite
                    isToday    -> accentColor
                    else       -> MaterialTheme.colorScheme.onSurface
                },
                textAlign = TextAlign.Center,
            )
        }

        // Points de séance
        if (dots.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                dots.forEach { dot ->
                    Box(
                        modifier = Modifier
                            .size(5.dp)
                            .clip(CircleShape)
                            .background(if (isSelected) PandaWhite.copy(alpha = 0.8f) else dot.color),
                    )
                }
            }
        }
    }
}
