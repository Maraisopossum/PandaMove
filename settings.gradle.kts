pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "PandaFit"

// App
include(":app")

// Core modules
include(":core:common")
include(":core:database")
include(":core:designsystem")

// Feature modules
include(":feature:home")
include(":feature:running")
include(":feature:cycling")
include(":feature:strength")
include(":feature:calendar")
include(":feature:stats")
include(":feature:profile")
include(":feature:timer")
include(":feature:warmup")
