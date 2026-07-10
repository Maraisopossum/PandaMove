package com.pandafit.feature.calendar.ui

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.pandafit.core.database.entities.BreathingSessionEntity
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.designsystem.components.SportDot
import com.pandafit.designsystem.theme.KalyptusGreen
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.calendar.R
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

// ===== Grille calendrier =====

@Composable
internal fun MonthNavigationHeader(currentMonth: YearMonth, onPrevious: () -> Unit, onNext: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        IconButton(onClick = onPrevious) { Icon(Icons.Default.ChevronLeft, stringResource(R.string.calendar_prev_month_cd)) }
        Text(
            text = currentMonth.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH)).replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        IconButton(onClick = onNext) { Icon(Icons.Default.ChevronRight, stringResource(R.string.calendar_next_month_cd)) }
    }
}

@Composable
internal fun MonthCalendarGrid(
    currentMonth: YearMonth,
    selectedDate: LocalDate,
    workoutsByDate: Map<LocalDate, List<WorkoutEntity>>,
    instancesByDate: Map<LocalDate, List<InstanceSeanceEntity>>,
    breathingSessionsByDate: Map<LocalDate, List<BreathingSessionEntity>>,
    onSelectDate: (LocalDate) -> Unit,
) {
    val today = LocalDate.now()
    val firstDayOfMonth = currentMonth.atDay(1)
    val daysInMonth = currentMonth.lengthOfMonth()
    val firstDayOfWeek = (firstDayOfMonth.dayOfWeek.value + 6) % 7
    val totalCells = firstDayOfWeek + daysInMonth

    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            listOf("L", "M", "M", "J", "V", "S", "D").forEach { day ->
                Text(day, modifier = Modifier.weight(1f), textAlign = TextAlign.Center, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(Modifier.height(8.dp))
        val weeks = ((totalCells + 6) / 7)
        repeat(weeks) { weekIndex ->
            Row(modifier = Modifier.fillMaxWidth()) {
                repeat(7) { dayOfWeek ->
                    val cellIndex = weekIndex * 7 + dayOfWeek
                    val dayNumber = cellIndex - firstDayOfWeek + 1
                    if (dayNumber < 1 || dayNumber > daysInMonth) {
                        Box(modifier = Modifier.weight(1f).aspectRatio(1f))
                    } else {
                        val date = currentMonth.atDay(dayNumber)
                        CalendarDayCell(
                            day = dayNumber,
                            date = date,
                            isSelected = date == selectedDate,
                            isToday = date == today,
                            workouts = workoutsByDate[date] ?: emptyList(),
                            hasStrengthInstance = (instancesByDate[date]?.isNotEmpty() == true),
                            hasBreathingSession = (breathingSessionsByDate[date]?.isNotEmpty() == true),
                            onClick = { onSelectDate(date) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            Spacer(Modifier.height(4.dp))
        }
    }
}

@Composable
private fun CalendarDayCell(
    day: Int, date: LocalDate, isSelected: Boolean, isToday: Boolean,
    workouts: List<WorkoutEntity>, hasStrengthInstance: Boolean, hasBreathingSession: Boolean = false,
    onClick: () -> Unit, modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.aspectRatio(1f).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier.size(30.dp).clip(CircleShape)
                    .background(when { isSelected -> PandaGreen; isToday -> PandaGreen.copy(alpha = 0.15f); else -> Color.Transparent }),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    day.toString(),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
                    color = when { isSelected -> Color.White; isToday -> PandaGreen; else -> MaterialTheme.colorScheme.onSurface },
                )
            }
            if (workouts.isNotEmpty() || hasStrengthInstance || hasBreathingSession) {
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(top = 2.dp)) {
                    workouts.take(2).forEach { SportDot(color = workoutTypeColor(it.workoutType), size = 5.dp) }
                    if (hasStrengthInstance) SportDot(color = PandaPurple, size = 5.dp)
                    if (hasBreathingSession) SportDot(color = KalyptusGreen, size = 5.dp)
                }
            }
        }
    }
}
