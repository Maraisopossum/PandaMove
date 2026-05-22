package com.pandafit

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.theme.PandaFitTheme
import com.pandafit.feature.profile.viewmodel.ProfileViewModel
import com.pandafit.navigation.PandaFitNavHost
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.delay

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    // Signale à setKeepOnScreenCondition que Compose a rendu son premier frame
    private var splashExited = false

    override fun onCreate(savedInstanceState: Bundle?) {
        // Garde le system splash jusqu'au premier frame Compose
        installSplashScreen().setKeepOnScreenCondition { !splashExited }
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            // S'exécute juste après que le premier frame est commis →
            // le system splash se retire au frame suivant
            SideEffect { splashExited = true }

            val profileVM: ProfileViewModel = hiltViewModel()
            val isDarkMode by profileVM.isDarkMode.collectAsStateWithLifecycle()

            var splashDone by remember { mutableStateOf(false) }
            LaunchedEffect(Unit) {
                delay(1500L)
                splashDone = true
            }

            if (!splashDone) {
                // Phase splash : frame ultra-léger → rendu quasi-instantané
                Image(
                    painter = painterResource(id = R.drawable.splash),
                    contentDescription = null,
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
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
}
