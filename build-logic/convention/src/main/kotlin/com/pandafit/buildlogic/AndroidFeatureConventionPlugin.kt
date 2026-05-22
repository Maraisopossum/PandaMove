package com.pandafit.buildlogic

import com.android.build.gradle.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies

class AndroidFeatureConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply {
                apply("pandafit.android.library")
                apply("pandafit.android.compose")
                apply("pandafit.android.hilt")
            }
            extensions.configure<LibraryExtension> {
                defaultConfig.targetSdk = 35
            }
            dependencies {
                add("implementation", project(":core:common"))
                add("implementation", project(":core:designsystem"))
                add("implementation", project(":core:database"))
            }
        }
    }
}
