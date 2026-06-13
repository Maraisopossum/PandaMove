package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Méthode de respiration créée par l'utilisateur.
 * Les durées sont en secondes ; une valeur de 0 signifie que la phase est désactivée.
 */
@Entity(tableName = "custom_breathing_method")
data class CustomBreathingMethodEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "emoji")
    val emoji: String,

    @ColumnInfo(name = "inhale_seconds")
    val inhaleSeconds: Int,

    /** 0 = phase désactivée. */
    @ColumnInfo(name = "hold_in_seconds")
    val holdInSeconds: Int = 0,

    @ColumnInfo(name = "exhale_seconds")
    val exhaleSeconds: Int,

    /** 0 = phase désactivée. */
    @ColumnInfo(name = "hold_out_seconds")
    val holdOutSeconds: Int = 0,

    @ColumnInfo(name = "default_cycles")
    val defaultCycles: Int,
)
