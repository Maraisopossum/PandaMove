package com.pandafit.core.database.activityimport

/**
 * Détecte le format d'un fichier d'activité à partir de ses premiers octets.
 * FIT = binaire, signature ASCII ".FIT" toujours présente à l'offset 8 du header
 * (spec FIT SDK, indépendante de la taille du header — 12 ou 14 octets).
 * TCX/GPX = XML, distingués par le tag racine (<TrainingCenterDatabase> vs <gpx>).
 */
fun detectActivityFormat(bytes: ByteArray): ActivityFileFormat? {
    if (bytes.size >= 12 &&
        bytes[8] == '.'.code.toByte() &&
        bytes[9] == 'F'.code.toByte() &&
        bytes[10] == 'I'.code.toByte() &&
        bytes[11] == 'T'.code.toByte()
    ) {
        return ActivityFileFormat.FIT
    }

    val head = try {
        String(bytes, 0, minOf(bytes.size, 2000), Charsets.UTF_8)
    } catch (e: Exception) {
        return null
    }

    return when {
        head.contains("<TrainingCenterDatabase") -> ActivityFileFormat.TCX
        head.contains("<gpx") -> ActivityFileFormat.GPX
        else -> null
    }
}
