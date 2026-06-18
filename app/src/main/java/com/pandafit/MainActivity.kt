package com.pandafit

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
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
import com.pandafit.navigation.NavigationRouter
import com.pandafit.navigation.PandaFitNavHost
import com.pandafit.service.ActiveSessionService
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    // Obtenu via delegate Activity (disponible avant setContent)
    private val profileViewModel: ProfileViewModel by viewModels()

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Notification tap quand l'app était en arrière-plan (singleTop)
        intent.getStringExtra(ActiveSessionService.EXTRA_ROUTE)?.let { NavigationRouter.navigate(it) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Le splash system reste affiché jusqu'au premier emit DataStore
        installSplashScreen().setKeepOnScreenCondition { !profileViewModel.isReady.value }
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)
        }
        // Notification tap quand l'app était fermée
        intent?.getStringExtra(ActiveSessionService.EXTRA_ROUTE)?.let { NavigationRouter.navigate(it) }

        setContent {
            PandaFitTheme {
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
