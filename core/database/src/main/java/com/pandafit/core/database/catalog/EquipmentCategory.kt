package com.pandafit.core.database.catalog

enum class EquipmentCategory(val label: String, val emoji: String) {
    POIDS_DE_CORPS("Poids de corps", "🏃"),
    HALTERES("Haltères", "🏋️"),
    BARRE("Barre", "🔩"),
    KETTLEBELL("Kettlebell", "🫙"),
    MACHINE("Machine", "⚙️"),
    CABLE("Câble / Poulie", "🔗"),
    BANC("Banc", "🪑"),
    RACK("Rack", "🗄️"),
    BARRE_TRACTION("Barre de traction / Parallèles", "🤸"),
    ELASTIQUE("Élastique", "🪢"),
    ACCESSOIRES("Accessoires", "🛠️"),
}

fun rawEquipmentToCategory(raw: String): EquipmentCategory? = when {
    raw.startsWith("Machine") || raw == "Smith machine" -> EquipmentCategory.MACHINE
    raw.startsWith("Câble") || raw == "Corde" -> EquipmentCategory.CABLE
    raw == "Barre de traction" -> EquipmentCategory.BARRE_TRACTION
    raw == "Barres parallèles" -> EquipmentCategory.BARRE_TRACTION
    raw.startsWith("Banc") || raw == "GHD / Banc à lombaires" -> EquipmentCategory.BANC
    raw == "Kettlebell" -> EquipmentCategory.KETTLEBELL
    raw.startsWith("Kettlebell") || raw.startsWith("Haltère") -> EquipmentCategory.HALTERES
    raw == "Poids de corps / Haltère" || raw == "Poids de corps / Barre" ||
        raw == "Poids de corps / Partenaire" || raw == "Poids de corps / Tapis" -> EquipmentCategory.POIDS_DE_CORPS
    raw == "Poids de corps" -> EquipmentCategory.POIDS_DE_CORPS
    raw.startsWith("Barre") || raw == "Trap bar / Hex bar" || raw == "Landmine" ||
        raw == "Disques de fonte" -> EquipmentCategory.BARRE
    raw == "Rack" || raw == "Barre de tirage" || raw == "Plateforme" -> EquipmentCategory.RACK
    raw == "Élastique" -> EquipmentCategory.ELASTIQUE
    raw == "Ab wheel" || raw == "Wrist roller" || raw == "Banc / appui" ||
        raw == "Banc / step" -> EquipmentCategory.ACCESSOIRES
    else -> null
}

fun CatalogExercise.requiredCategories(): Set<EquipmentCategory> =
    equipment.mapNotNull { rawEquipmentToCategory(it) }.toSet()

fun CatalogExercise.matchesEquipment(userEquipment: Set<EquipmentCategory>): Boolean {
    val required = requiredCategories()
    if (required.isEmpty()) return true
    // Poids de corps: si l'exercice nécessite uniquement Poids de corps, toujours disponible
    if (required == setOf(EquipmentCategory.POIDS_DE_CORPS)) return true
    // Sinon : au moins toutes les catégories requises doivent être disponibles
    return userEquipment.containsAll(required)
}
