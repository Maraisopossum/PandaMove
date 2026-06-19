package com.pandafit.core.database.worker

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.pandafit.core.database.catalog.BackupPreferencesRepository
import com.pandafit.core.database.export.DataExportManager
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first
import java.time.LocalDate

@HiltWorker
class DriveBackupWorker @AssistedInject constructor(
    @Assisted private val context: Context,
    @Assisted params: WorkerParameters,
    private val exportManager: DataExportManager,
    private val backupPrefs: BackupPreferencesRepository,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val folderUriStr = backupPrefs.backupFolderUri.first() ?: return Result.success()
        val folderUri = Uri.parse(folderUriStr)

        val folder = DocumentFile.fromTreeUri(context, folderUri) ?: return Result.failure()
        if (!folder.canWrite()) return Result.failure()

        val jsonFile = exportManager.export()
        val bytes = jsonFile.readBytes()

        val existing = folder.findFile(BACKUP_FILENAME)
        val target = existing ?: folder.createFile("application/json", BACKUP_FILENAME)
            ?: return Result.failure()

        context.contentResolver.openOutputStream(target.uri, "wt")?.use { it.write(bytes) }
            ?: return Result.failure()

        backupPrefs.setLastBackupDate(LocalDate.now().toString())
        return Result.success()
    }

    companion object {
        const val BACKUP_FILENAME = "pandamove_backup.json"
        const val WORK_NAME      = "pandamove_drive_backup"
    }
}
