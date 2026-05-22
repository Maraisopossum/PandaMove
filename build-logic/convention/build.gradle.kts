import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    `kotlin-dsl`
}

group = "com.pandafit.buildlogic"

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
    }
}

dependencies {
    compileOnly(libs.android.gradlePlugin)
    compileOnly(libs.kotlin.gradlePlugin)
    compileOnly(libs.compose.gradlePlugin)
    compileOnly(libs.hilt.gradlePlugin)
    compileOnly(libs.ksp.gradlePlugin)
}

gradlePlugin {
    plugins {
        register("androidApplication") {
            id = "pandafit.android.application"
            implementationClass = "com.pandafit.buildlogic.AndroidApplicationConventionPlugin"
        }
        register("androidLibrary") {
            id = "pandafit.android.library"
            implementationClass = "com.pandafit.buildlogic.AndroidLibraryConventionPlugin"
        }
        register("androidFeature") {
            id = "pandafit.android.feature"
            implementationClass = "com.pandafit.buildlogic.AndroidFeatureConventionPlugin"
        }
        register("androidHilt") {
            id = "pandafit.android.hilt"
            implementationClass = "com.pandafit.buildlogic.AndroidHiltConventionPlugin"
        }
        register("androidCompose") {
            id = "pandafit.android.compose"
            implementationClass = "com.pandafit.buildlogic.AndroidComposeConventionPlugin"
        }
        register("androidRoom") {
            id = "pandafit.android.room"
            implementationClass = "com.pandafit.buildlogic.AndroidRoomConventionPlugin"
        }
    }
}
