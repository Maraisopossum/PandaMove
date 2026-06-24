package com.pandafit.core.database.di

import android.content.Context
import androidx.room.Room
import com.pandafit.core.database.PandaFitDatabase
import com.pandafit.core.database.dao.BreathingSessionDao
import com.pandafit.core.database.dao.CustomBreathingMethodDao
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.ObjectifProgressionDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.WorkoutBlockDao
import com.pandafit.core.database.dao.WorkoutDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): PandaFitDatabase =
        Room.databaseBuilder(
            context,
            PandaFitDatabase::class.java,
            PandaFitDatabase.DATABASE_NAME,
        )
            .addMigrations(
                PandaFitDatabase.MIGRATION_3_4,
                PandaFitDatabase.MIGRATION_4_5,
                PandaFitDatabase.MIGRATION_5_6,
                PandaFitDatabase.MIGRATION_6_7,
                PandaFitDatabase.MIGRATION_7_8,
                PandaFitDatabase.MIGRATION_8_9,
                PandaFitDatabase.MIGRATION_9_10,
                PandaFitDatabase.MIGRATION_10_11,
                PandaFitDatabase.MIGRATION_11_12,
                PandaFitDatabase.MIGRATION_12_13,
                PandaFitDatabase.MIGRATION_13_14,
                PandaFitDatabase.MIGRATION_14_15,
                PandaFitDatabase.MIGRATION_15_16,
                PandaFitDatabase.MIGRATION_16_17,
                PandaFitDatabase.MIGRATION_17_18,
                PandaFitDatabase.MIGRATION_18_19,
                PandaFitDatabase.MIGRATION_19_20,
                PandaFitDatabase.MIGRATION_20_21,
                PandaFitDatabase.MIGRATION_21_22,
                PandaFitDatabase.MIGRATION_22_23,
                PandaFitDatabase.MIGRATION_23_24,
            )
            .build()

    @Provides
    fun provideWorkoutDao(db: PandaFitDatabase): WorkoutDao = db.workoutDao()

    @Provides
    fun provideWorkoutBlockDao(db: PandaFitDatabase): WorkoutBlockDao = db.workoutBlockDao()

    @Provides
    fun provideExerciseDao(db: PandaFitDatabase): ExerciseDao = db.exerciseDao()

    @Provides
    fun provideSeanceDao(db: PandaFitDatabase): SeanceDao = db.seanceDao()

    @Provides
    fun provideInstanceSeanceDao(db: PandaFitDatabase): InstanceSeanceDao = db.instanceSeanceDao()

    @Provides
    fun provideRunStepDao(db: PandaFitDatabase): RunStepDao = db.runStepDao()

    @Provides
    fun provideRunRepeatDao(db: PandaFitDatabase): RunRepeatDao = db.runRepeatDao()

    @Provides
    fun provideGpsTrackPointDao(db: PandaFitDatabase): GpsTrackPointDao = db.gpsTrackPointDao()

    @Provides
    fun provideBreathingSessionDao(db: PandaFitDatabase): BreathingSessionDao = db.breathingSessionDao()

    @Provides
    fun provideCustomBreathingMethodDao(db: PandaFitDatabase): CustomBreathingMethodDao = db.customBreathingMethodDao()

    @Provides
    fun provideObjectifProgressionDao(db: PandaFitDatabase): ObjectifProgressionDao = db.objectifProgressionDao()

}
