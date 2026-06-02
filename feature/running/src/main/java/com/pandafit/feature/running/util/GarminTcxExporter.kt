package com.pandafit.feature.running.util

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.FileProvider
import com.pandafit.core.database.entities.BlockType
import com.pandafit.core.database.entities.WorkoutBlockEntity
import com.pandafit.core.database.entities.WorkoutEntity
import java.io.File

// NOTE: This exporter requires a FileProvider configured in the app's AndroidManifest.xml:
//
//   <provider
//       android:name="androidx.core.content.FileProvider"
//       android:authorities="${applicationId}.fileprovider"
//       android:exported="false"
//       android:grantUriPermissions="true">
//       <meta-data
//           android:name="android.support.FILE_PROVIDER_PATHS"
//           android:resource="@xml/file_paths" />
//   </provider>
//
// And a file_paths.xml resource in app/src/main/res/xml/:
//
//   <?xml version="1.0" encoding="utf-8"?>
//   <paths>
//       <cache-path name="cache" path="." />
//   </paths>

object GarminTcxExporter {

    private const val GARMIN_PACKAGE = "com.garmin.android.apps.connectmobile"

    fun exportAndShare(context: Context, workout: WorkoutEntity, blocks: List<WorkoutBlockEntity>) {
        // Nettoyer les anciens exports TCX pour ne pas saturer le cacheDir
        context.cacheDir
            .listFiles { f -> f.extension == "tcx" }
            ?.forEach { it.delete() }

        val tcx = buildTcx(workout, blocks)
        val fileName = "${workout.name.replace("[^a-zA-Z0-9_]".toRegex(), "_")}.tcx"
        val file = File(context.cacheDir, fileName)
        try {
            file.writeText(tcx, Charsets.UTF_8)
        } catch (e: Exception) {
            file.delete()
            throw e
        }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)

        val garminInstalled = try {
            context.packageManager.getPackageInfo(GARMIN_PACKAGE, PackageManager.GET_ACTIVITIES)
            true
        } catch (_: PackageManager.NameNotFoundException) { false }

        if (garminInstalled) {
            // Ouvre directement Garmin Connect
            val direct = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.garmin.tcx+xml")
                setPackage(GARMIN_PACKAGE)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(direct)
        } else {
            // Share sheet générique — MIME */* pour que toutes les applis compatibles apparaissent
            val share = Intent(Intent.ACTION_SEND).apply {
                type = "*/*"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "Séance running : ${workout.name}")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(share, "Exporter le fichier TCX"))
        }
    }

    private fun buildTcx(workout: WorkoutEntity, blocks: List<WorkoutBlockEntity>): String {
        val sb = StringBuilder()
        sb.appendLine("""<?xml version="1.0" encoding="UTF-8"?>""")
        sb.appendLine("""<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">""")
        sb.appendLine("  <Workouts>")
        sb.appendLine("    <Workout Sport=\"Running\">")
        sb.appendLine("      <Name>${esc(workout.name)}</Name>")
        var stepId = 1
        blocks.sortedBy { it.position }.forEach { block ->
            if (block.blockType == BlockType.INTERVAL && (block.repetitions ?: 0) > 1) {
                sb.appendLine("      <Step xsi:type=\"Repeat_t\">")
                sb.appendLine("        <StepId>${stepId++}</StepId>")
                sb.appendLine("        <Repetitions>${block.repetitions}</Repetitions>")
                // Active interval child
                sb.appendLine("        <Child xsi:type=\"Step_t\">")
                sb.appendLine("          <StepId>${stepId++}</StepId>")
                sb.appendLine("          <Name>${esc(block.name)}</Name>")
                appendDuration(sb, block, "          ")
                appendTarget(sb, block, "          ")
                sb.appendLine("          <Intensity>Active</Intensity>")
                sb.appendLine("        </Child>")
                // Recovery child
                if (block.recoveryDurationSec != null || block.recoveryDistanceM != null || block.recoveryMinutes != null) {
                    sb.appendLine("        <Child xsi:type=\"Step_t\">")
                    sb.appendLine("          <StepId>${stepId++}</StepId>")
                    sb.appendLine("          <Name>Récupération</Name>")
                    val recSec = block.recoveryDurationSec ?: block.recoveryMinutes?.let { it * 60 }
                    val recM = block.recoveryDistanceM
                    when {
                        recM != null -> sb.appendLine("          <Duration xsi:type=\"Distance_t\"><Meters>$recM</Meters></Duration>")
                        recSec != null -> sb.appendLine("          <Duration xsi:type=\"Time_t\"><Seconds>$recSec</Seconds></Duration>")
                        else -> sb.appendLine("          <Duration xsi:type=\"UserInitiated_t\"/>")
                    }
                    sb.appendLine("          <Intensity>Resting</Intensity>")
                    sb.appendLine("          <Target xsi:type=\"None_t\"/>")
                    sb.appendLine("        </Child>")
                }
                sb.appendLine("      </Step>")
            } else {
                sb.appendLine("      <Step xsi:type=\"Step_t\">")
                sb.appendLine("        <StepId>${stepId++}</StepId>")
                sb.appendLine("        <Name>${esc(block.name)}</Name>")
                appendDuration(sb, block, "        ")
                appendTarget(sb, block, "        ")
                val intensity = when (block.blockType) { BlockType.WARMUP -> "Warmup"; BlockType.COOLDOWN -> "Cooldown"; else -> "Active" }
                sb.appendLine("        <Intensity>$intensity</Intensity>")
                sb.appendLine("      </Step>")
            }
        }
        sb.appendLine("    </Workout>")
        sb.appendLine("  </Workouts>")
        sb.appendLine("</TrainingCenterDatabase>")
        return sb.toString()
    }

    private fun appendDuration(sb: StringBuilder, b: WorkoutBlockEntity, indent: String) {
        val distM = b.distanceM ?: b.distanceKm?.let { (it * 1000).toInt() }
        val durSec = b.durationMinutes?.let { it * 60 }
        when {
            distM != null -> sb.appendLine("${indent}<Duration xsi:type=\"Distance_t\"><Meters>$distM</Meters></Duration>")
            durSec != null -> sb.appendLine("${indent}<Duration xsi:type=\"Time_t\"><Seconds>$durSec</Seconds></Duration>")
            else -> sb.appendLine("${indent}<Duration xsi:type=\"UserInitiated_t\"/>")
        }
    }

    private fun appendTarget(sb: StringBuilder, b: WorkoutBlockEntity, indent: String) {
        when (b.targetType) {
            "pace" -> {
                val lo = b.targetPaceMaxMinPerKm?.let { 1000.0 / (it * 60.0) } ?: 0.0
                val hi = b.targetPaceMinPerKm?.let { 1000.0 / (it * 60.0) } ?: 99.0
                sb.appendLine("${indent}<Target xsi:type=\"Speed_t\">")
                sb.appendLine("${indent}  <SpeedZone xsi:type=\"CustomSpeedZone_t\">")
                sb.appendLine("${indent}    <LowInMetersPerSecond>${"%.4f".format(lo)}</LowInMetersPerSecond>")
                sb.appendLine("${indent}    <HighInMetersPerSecond>${"%.4f".format(hi)}</HighInMetersPerSecond>")
                sb.appendLine("${indent}  </SpeedZone>")
                sb.appendLine("${indent}</Target>")
            }
            "hr" -> {
                sb.appendLine("${indent}<Target xsi:type=\"HeartRate_t\">")
                sb.appendLine("${indent}  <HeartRateZone xsi:type=\"CustomHeartRateZone_t\">")
                sb.appendLine("${indent}    <Low>${b.targetHrMin ?: 0}</Low>")
                sb.appendLine("${indent}    <High>${b.targetHrMax ?: 220}</High>")
                sb.appendLine("${indent}  </HeartRateZone>")
                sb.appendLine("${indent}</Target>")
            }
            else -> sb.appendLine("${indent}<Target xsi:type=\"None_t\"/>")
        }
    }

    private fun esc(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
}
