pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

// Projet Gradle INDÉPENDANT de l'application Android PandaFit (racine du dépôt, abandonnée) : ne dépend d'aucun de ses modules.
rootProject.name = "PandaMoveWidget"
include(":app")
