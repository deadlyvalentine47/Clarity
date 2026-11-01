package com.clarity.app.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private fun themeColors(themeName: String, dark: Boolean): ColorScheme {
    val t = allThemes[themeName] ?: Ocean
    return if (dark) darkColorScheme(
        primary = t.primary, onPrimary = t.onPrimary,
        primaryContainer = t.onPrimaryContainer,
        secondary = t.secondary, onSecondary = t.onSecondary,
        secondaryContainer = t.onSecondaryContainer,
        background = t.backgroundDark, onBackground = t.onBackgroundDark,
        surface = t.surfaceDark, onSurface = t.onSurfaceDark,
        error = t.error, onError = t.onError
    ) else lightColorScheme(
        primary = t.primary, onPrimary = t.onPrimary,
        primaryContainer = t.primaryContainer,
        onPrimaryContainer = t.onPrimaryContainer,
        secondary = t.secondary, onSecondary = t.onSecondary,
        secondaryContainer = t.secondaryContainer,
        onSecondaryContainer = t.onSecondaryContainer,
        background = t.backgroundLight, onBackground = t.onBackgroundLight,
        surface = t.surfaceLight, onSurface = t.onSurfaceLight,
        error = t.error, onError = t.onError
    )
}

@Composable
fun ClarityTheme(
    themeName: String = "Ocean",
    darkTheme: Boolean? = null,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val systemDarkTheme = isSystemInDarkTheme()
    val isDark = darkTheme ?: systemDarkTheme

    val colorScheme = if (dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val context = LocalContext.current
        if (isDark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    } else {
        themeColors(themeName, isDark)
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !isDark
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
