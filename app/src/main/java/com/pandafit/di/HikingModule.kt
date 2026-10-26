package com.pandafit.di

import com.pandafit.feature.hiking.GpsHikingController
import com.pandafit.service.HikingTrackingController
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class HikingModule {
    @Binds
    abstract fun bindGpsHikingController(impl: HikingTrackingController): GpsHikingController
}
