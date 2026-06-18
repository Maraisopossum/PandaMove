package com.pandafit.navigation

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Canal de navigation one-shot entre la couche Android (MainActivity, Services)
 * et le NavController Compose. Évite de passer le NavController hors du Composable.
 */
object NavigationRouter {
    private val _pendingRoute = MutableStateFlow<String?>(null)
    val pendingRoute: StateFlow<String?> = _pendingRoute.asStateFlow()

    fun navigate(route: String) { _pendingRoute.value = route }
    fun consume()               { _pendingRoute.value = null }
}
