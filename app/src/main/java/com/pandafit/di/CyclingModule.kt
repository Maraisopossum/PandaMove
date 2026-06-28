package com.pandafit.di

import com.pandafit.feature.cycling.GpsCyclingController
import com.pandafit.service.CyclingTrackingController
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class CyclingModule {
    @Binds
    abstract fun bindGpsCyclingController(impl: CyclingTrackingController): GpsCyclingController
}
