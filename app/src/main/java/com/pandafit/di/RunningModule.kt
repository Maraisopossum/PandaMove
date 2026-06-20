package com.pandafit.di

import com.pandafit.feature.running.GpsTrackingController
import com.pandafit.service.RunningTrackingController
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class RunningModule {
    @Binds
    abstract fun bindGpsTrackingController(impl: RunningTrackingController): GpsTrackingController
}
