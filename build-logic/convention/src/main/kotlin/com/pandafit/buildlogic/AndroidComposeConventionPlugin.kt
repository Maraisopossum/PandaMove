package com.pandafit.buildlogic

import com.android.build.gradle.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies

class AndroidComposeConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("org.jetbrains.kotlin.plugin.compose")
            extensions.configure<LibraryExtension> {
                buildFeatures.compose = true
            }
            dependencies {
                val bom = libs.findLibrary("compose.bom").get()
                add("implementation", platform(bom))
                add("androidTestImplementation", platform(bom))
                add("implementation", libs.findBundle("compose").get())
                add("debugImplementation", libs.findLibrary("compose.ui.tooling").get())
                add("debugImplementation", libs.findLibrary("compose.ui.test.manifest").get())
                add("implementation", libs.findLibrary("hilt.navigation.compose").get())
                add("implementation", libs.findLibrary("navigation.compose").get())
                add("implementation", libs.findBundle("lifecycle").get())
            }
        }
    }
}
