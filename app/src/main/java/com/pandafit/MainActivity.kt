package com.pandafit

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.pandafit.designsystem.theme.PandaFitTheme
import com.pandafit.feature.profile.viewmodel.ProfileViewModel
import com.pandafit.navigation.PandaFitNavHost
import dagger.hilt.android.AndroidEntryPoint
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.getValue

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    // Obtenu via delegate Activity (disponible avant setContent)
    private val profileViewModel: ProfileViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        // Le splash system reste affiché jusqu'au premier emit DataStore
        installSplashScreen().setKeepOnScreenCondition { !profileViewModel.isReady.value }
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val isDarkMode by profileViewModel.isDarkMode.collectAsStateWithLifecycle()

            PandaFitTheme(darkTheme = isDarkMode) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    PandaFitNavHost()
                }
            }
        }
    }
}
