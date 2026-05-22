package com.pandafit.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.TextUnitType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

// ─── Menu principal ───────────────────────────────────────────────────────────

@Composable
fun AssignMenuDialog(
    onDismiss: () -> Unit,
    onSingleDate: () -> Unit,
    onMultipleDates: () -> Unit,
    onRecurrence: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Affecter la séance") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(
                    onClick = { onDismiss(); onSingleDate() },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Default.CalendarMonth, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Une date", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                }
                TextButton(
                    onClick = { onDismiss(); onMultipleDates() },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Plusieurs dates", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                }
                TextButton(
                    onClick = { onDismiss(); onRecurrence() },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Default.Repeat, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Récurrence", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annuler") } },
    )
}

// ─── Single-date picker ───────────────────────────────────────────────────────

@Composable
fun AssignSingleDatePickerDialog(
    title: String = "Sélectionner une date",
    confirmLabel: String = "Affecter",
    initialDate: LocalDate = LocalDate.now(),
    minDate: LocalDate = LocalDate.now(),
    onDismiss: () -> Unit,
    onConfirm: (LocalDate) -> Unit,
) {
    var selectedDate by remember { mutableStateOf<LocalDate?>(null) }
    val today = LocalDate.now()
    var displayMonth by remember { mutableStateOf(initialDate.withDayOfMonth(1)) }

    val dayFmt = DateTimeFormatter.ofPattern("d", Locale.FRENCH)
    val monthTitleFmt = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH)
    val dayLabels = listOf("L", "M", "M", "J", "V", "S", "D")

    val startOffset = displayMonth.dayOfWeek.value - 1
    val cells: List<LocalDate?> = (0 until startOffset).map { null } +
            (1..displayMonth.lengthOfMonth()).map { displayMonth.withDayOfMonth(it) }
    val rows = cells.chunked(7)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
        ) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {

                Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)

                // Navigation mois
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = { displayMonth = displayMonth.minusMonths(1) },
                        enabled = displayMonth > minDate.withDayOfMonth(1),
                    ) {
                        Icon(Icons.Default.KeyboardArrowLeft, contentDescription = "Mois précédent", tint = PandaSubtext)
                    }
                    Text(
                        displayMonth.format(monthTitleFmt).replaceFirstChar { it.uppercase() },
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    IconButton(onClick = { displayMonth = displayMonth.plusMonths(1) }) {
                        Icon(Icons.Default.KeyboardArrowRight, contentDescription = "Mois suivant", tint = PandaSubtext)
                    }
                }

                // En-têtes jours
                Row(modifier = Modifier.fillMaxWidth()) {
                    dayLabels.forEach { d ->
                        Text(
                            d,
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.labelSmall,
                            color = PandaSubtext,
                        )
                    }
                }

                // Grille
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    rows.forEach { row ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            row.forEach { date ->
                                if (date == null) {
                                    Spacer(Modifier.weight(1f))
                                } else {
                                    val isSelected = date == selectedDate
                                    val isToday = date == today
                                    val isDisabled = date.isBefore(minDate)
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .aspectRatio(1f)
                                            .padding(2.dp)
                                            .clip(CircleShape)
                                            .background(
                                                when {
                                                    isSelected -> PandaPurple
                                                    isToday -> PandaPurple.copy(alpha = 0.15f)
                                                    else -> Color.Transparent
                                                }
                                            )
                                            .then(
                                                if (!isDisabled) Modifier.clickable { selectedDate = date }
                                                else Modifier
                                            ),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            date.format(dayFmt),
                                            style = MaterialTheme.typography.bodySmall,
                                            fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
                                            color = when {
                                                isSelected -> Color.White
                                                isDisabled -> PandaSubtext.copy(alpha = 0.35f)
                                                else -> MaterialTheme.colorScheme.onSurface
                                            },
                                        )
                                    }
                                }
                            }
                            repeat(7 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }

                // Boutons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = onDismiss) { Text("Annuler") }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = { selectedDate?.let { onConfirm(it) } },
                        enabled = selectedDate != null,
                        colors = ButtonDefaults.buttonColors(containerColor = PandaPurple),
                    ) {
                        Text(confirmLabel, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

// ─── Multi-date picker ────────────────────────────────────────────────────────

@Composable
fun AssignMultiDatePickerDialog(
    onDismiss: () -> Unit,
    onConfirm: (Set<LocalDate>) -> Unit,
) {
    var selectedDates by remember { mutableStateOf(setOf<LocalDate>()) }
    val today = LocalDate.now()
    // Mois courant affiché (1er du mois)
    var displayMonth by remember { mutableStateOf(today.withDayOfMonth(1)) }

    val dayFmt = DateTimeFormatter.ofPattern("d", Locale.FRENCH)
    val monthTitleFmt = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH)
    val dayLabels = listOf("L", "M", "M", "J", "V", "S", "D")

    // Cellules du mois : null pour les cases vides en début de grille
    val daysInMonth = displayMonth.lengthOfMonth()
    val startOffset = displayMonth.dayOfWeek.value - 1  // Lundi = 0
    val cells: List<LocalDate?> = (0 until startOffset).map { null } +
            (1..daysInMonth).map { displayMonth.withDayOfMonth(it) }
    val rows = cells.chunked(7)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
        ) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {

                // ── Titre ──
                Text(
                    "Plusieurs dates",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                )

                // ── Navigation mois : < Mai 2026 > ──
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(
                        onClick = { displayMonth = displayMonth.minusMonths(1) },
                        enabled = displayMonth.isAfter(today.withDayOfMonth(1).minusMonths(1)),
                    ) {
                        Icon(Icons.Default.KeyboardArrowLeft, contentDescription = "Mois précédent", tint = PandaSubtext)
                    }
                    Text(
                        displayMonth.format(monthTitleFmt).replaceFirstChar { it.uppercase() },
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    IconButton(onClick = { displayMonth = displayMonth.plusMonths(1) }) {
                        Icon(Icons.Default.KeyboardArrowRight, contentDescription = "Mois suivant", tint = PandaSubtext)
                    }
                }

                // ── En-têtes jours de la semaine ──
                Row(modifier = Modifier.fillMaxWidth()) {
                    dayLabels.forEach { d ->
                        Text(
                            d,
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.labelSmall,
                            color = PandaSubtext,
                        )
                    }
                }

                // ── Grille du mois ──
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    rows.forEach { row ->
                        Row(modifier = Modifier.fillMaxWidth()) {
                            row.forEach { date ->
                                if (date == null) {
                                    Spacer(Modifier.weight(1f))
                                } else {
                                    val isSelected = date in selectedDates
                                    val isToday = date == today
                                    val isPast = date.isBefore(today)
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .aspectRatio(1f)
                                            .padding(2.dp)
                                            .clip(CircleShape)
                                            .background(
                                                when {
                                                    isSelected -> PandaPurple
                                                    isToday -> PandaPurple.copy(alpha = 0.15f)
                                                    else -> Color.Transparent
                                                }
                                            )
                                            .then(
                                                if (!isPast) Modifier.clickable {
                                                    selectedDates = if (isSelected) selectedDates - date else selectedDates + date
                                                } else Modifier
                                            ),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            date.format(dayFmt),
                                            style = MaterialTheme.typography.bodySmall,
                                            fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
                                            color = when {
                                                isSelected -> Color.White
                                                isPast -> PandaSubtext.copy(alpha = 0.35f)
                                                else -> MaterialTheme.colorScheme.onSurface
                                            },
                                        )
                                    }
                                }
                            }
                            repeat(7 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }

                // ── Badge sélection ──
                if (selectedDates.isNotEmpty()) {
                    Surface(
                        color = PandaPurple.copy(alpha = 0.08f),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Text(
                            "${selectedDates.size} date${if (selectedDates.size > 1) "s" else ""} sélectionnée${if (selectedDates.size > 1) "s" else ""}",
                            style = MaterialTheme.typography.bodySmall,
                            color = PandaPurple,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        )
                    }
                }

                // ── Boutons ──
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = onDismiss) { Text("Annuler") }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = { if (selectedDates.isNotEmpty()) onConfirm(selectedDates) },
                        enabled = selectedDates.isNotEmpty(),
                        colors = ButtonDefaults.buttonColors(containerColor = PandaPurple),
                    ) {
                        Text("Affecter", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

// ─── Récurrence ───────────────────────────────────────────────────────────────

private enum class RecurrenceUnit(val label: String) {
    JOUR("jour"), SEMAINE("semaine"), MOIS("mois")
}

private enum class EndType { JAMAIS, END_DATE, AFTER_N }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssignRecurrenceDialog(
    onDismiss: () -> Unit,
    onConfirm: (startDate: LocalDate, intervalDays: Int, occurrences: Int) -> Unit,
) {
    // ── État fréquence ──
    var freqCount by remember { mutableIntStateOf(1) }
    var freqUnit by remember { mutableStateOf(RecurrenceUnit.SEMAINE) }
    var unitExpanded by remember { mutableStateOf(false) }

    // ── Date de début ──
    var startDate by remember { mutableStateOf(LocalDate.now()) }
    var showStartPicker by remember { mutableStateOf(false) }

    // ── Fin ──
    var endType by remember { mutableStateOf(EndType.JAMAIS) }
    var afterNCount by remember { mutableIntStateOf(8) }
    var endDate by remember { mutableStateOf(LocalDate.now().plusMonths(2)) }
    var showEndDatePicker by remember { mutableStateOf(false) }

    val dateFmt = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.FRENCH)

    // ── Calcul de l'intervalle et du nombre d'occurrences à soumettre ──
    val intervalDays = freqCount * when (freqUnit) {
        RecurrenceUnit.JOUR -> 1
        RecurrenceUnit.SEMAINE -> 7
        RecurrenceUnit.MOIS -> 30
    }
    val computedOccurrences = when (endType) {
        EndType.JAMAIS -> when (freqUnit) {
            RecurrenceUnit.JOUR -> 365
            RecurrenceUnit.SEMAINE -> 52
            RecurrenceUnit.MOIS -> 12
        }
        EndType.END_DATE -> {
            val days = java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate).toInt()
            if (intervalDays > 0 && days >= 0) (days / intervalDays) + 1 else 1
        }
        EndType.AFTER_N -> afterNCount
    }

    // ── Date pickers internes ──
    if (showStartPicker) {
        AssignSingleDatePickerDialog(
            title = "Date de début",
            confirmLabel = "OK",
            initialDate = startDate,
            minDate = LocalDate.now(),
            onDismiss = { showStartPicker = false },
            onConfirm = { startDate = it; showStartPicker = false },
        )
    }

    if (showEndDatePicker) {
        AssignSingleDatePickerDialog(
            title = "Date de fin",
            confirmLabel = "OK",
            initialDate = endDate,
            minDate = startDate.plusDays(1),
            onDismiss = { showEndDatePicker = false },
            onConfirm = { endDate = it; showEndDatePicker = false },
        )
    }

    // ── Dialog principal ──
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
        ) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {

                // Titre
                Text(
                    "Récurrence",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                )

                // ── Section : Fréquence ──
                RecurrenceSection(title = "Fréquence de répétition") {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        // Stepper nombre
                        StepperButton(icon = Icons.Default.Remove, onClick = { if (freqCount > 1) freqCount-- })
                        Text(
                            freqCount.toString(),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.widthIn(min = 28.dp),
                            textAlign = TextAlign.Center,
                        )
                        StepperButton(icon = Icons.Default.Add, onClick = { freqCount++ })

                        Spacer(Modifier.width(4.dp))

                        // Dropdown unité
                        ExposedDropdownMenuBox(
                            expanded = unitExpanded,
                            onExpandedChange = { unitExpanded = it },
                            modifier = Modifier.weight(1f),
                        ) {
                            OutlinedTextField(
                                value = if (freqCount == 1) freqUnit.label else freqUnit.label + "s",
                                onValueChange = {},
                                readOnly = true,
                                singleLine = true,
                                trailingIcon = {
                                    Icon(Icons.Default.KeyboardArrowDown, null,
                                        Modifier.clickable { unitExpanded = true })
                                },
                                modifier = Modifier.menuAnchor(),
                            )
                            ExposedDropdownMenu(
                                expanded = unitExpanded,
                                onDismissRequest = { unitExpanded = false },
                            ) {
                                RecurrenceUnit.entries.forEach { unit ->
                                    DropdownMenuItem(
                                        text = { Text(if (freqCount == 1) unit.label else unit.label + "s") },
                                        onClick = { freqUnit = unit; unitExpanded = false },
                                    )
                                }
                            }
                        }
                    }
                }

                // ── Section : Date de début ──
                RecurrenceSection(title = "Date de début") {
                    OutlinedButton(
                        onClick = { showStartPicker = true },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Default.CalendarMonth, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(startDate.format(dateFmt).replaceFirstChar { it.uppercase() })
                    }
                }

                // ── Section : Se termine ──
                RecurrenceSection(title = "Se termine") {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {

                        // Option Jamais
                        EndTypeRow(
                            selected = endType == EndType.JAMAIS,
                            onClick = { endType = EndType.JAMAIS },
                            label = "Jamais",
                        )

                        // Option Le [date]
                        EndTypeRow(
                            selected = endType == EndType.END_DATE,
                            onClick = { endType = EndType.END_DATE },
                            label = "Le",
                            trailing = {
                                TextButton(
                                    onClick = { endType = EndType.END_DATE; showEndDatePicker = true },
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                                ) {
                                    Text(
                                        endDate.format(dateFmt).replaceFirstChar { it.uppercase() },
                                        color = if (endType == EndType.END_DATE) PandaPurple else PandaSubtext,
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                }
                            },
                        )

                        // Option Après N occurrences
                        EndTypeRow(
                            selected = endType == EndType.AFTER_N,
                            onClick = { endType = EndType.AFTER_N },
                            label = "Après",
                            trailing = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    StepperButton(
                                        icon = Icons.Default.Remove,
                                        onClick = { endType = EndType.AFTER_N; if (afterNCount > 1) afterNCount-- },
                                        size = 28.dp,
                                    )
                                    Text(
                                        afterNCount.toString(),
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.widthIn(min = 24.dp),
                                        textAlign = TextAlign.Center,
                                        color = if (endType == EndType.AFTER_N) MaterialTheme.colorScheme.onSurface else PandaSubtext,
                                    )
                                    StepperButton(
                                        icon = Icons.Default.Add,
                                        onClick = { endType = EndType.AFTER_N; afterNCount++ },
                                        size = 28.dp,
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    Text(
                                        "occurrence${if (afterNCount > 1) "s" else ""}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (endType == EndType.AFTER_N) PandaSubtext else PandaSubtext.copy(alpha = 0.5f),
                                    )
                                }
                            },
                        )
                    }
                }

                // ── Résumé ──
                if (endType != EndType.JAMAIS) {
                    val lastDate = startDate.plusDays(((computedOccurrences - 1) * intervalDays).toLong())
                    val shortFmt = DateTimeFormatter.ofPattern("d MMM", Locale.FRENCH)
                    Surface(
                        color = PandaPurple.copy(alpha = 0.08f),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Text(
                            "Toutes les ${if (freqCount == 1) "" else "$freqCount "}${if (freqCount == 1) freqUnit.label else freqUnit.label + "s"}" +
                                    " · $computedOccurrences séance${if (computedOccurrences > 1) "s" else ""}" +
                                    " · jusqu'au ${lastDate.format(shortFmt)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = PandaPurple,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        )
                    }
                }

                // ── Boutons ──
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = onDismiss) { Text("Annuler") }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = { onConfirm(startDate, intervalDays, computedOccurrences) },
                        colors = ButtonDefaults.buttonColors(containerColor = PandaPurple),
                    ) {
                        Text("Créer", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

// ─── Composables internes ────────────────────────────────────────────────────

@Composable
private fun RecurrenceSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            title.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = PandaSubtext,
            fontWeight = FontWeight.Bold,
            letterSpacing = TextUnit(1.2f, TextUnitType.Sp),
        )
        content()
    }
}

@Composable
private fun EndTypeRow(
    selected: Boolean,
    onClick: () -> Unit,
    label: String,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = onClick)
        Spacer(Modifier.width(4.dp))
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = if (selected) MaterialTheme.colorScheme.onSurface else PandaSubtext,
        )
        if (trailing != null) {
            Spacer(Modifier.width(4.dp))
            trailing()
        }
    }
}

@Composable
private fun StepperButton(
    icon: ImageVector,
    onClick: () -> Unit,
    size: Dp = 36.dp,
) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, modifier = Modifier.size(size * 0.5f), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
