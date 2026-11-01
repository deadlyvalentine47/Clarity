package com.clarity.app.ui.theme

import androidx.compose.ui.graphics.Color

data class ThemePalette(
    val primary: Color,
    val onPrimary: Color,
    val primaryContainer: Color,
    val onPrimaryContainer: Color,
    val secondary: Color,
    val onSecondary: Color,
    val secondaryContainer: Color,
    val onSecondaryContainer: Color,
    val backgroundLight: Color,
    val onBackgroundLight: Color,
    val surfaceLight: Color,
    val onSurfaceLight: Color,
    val backgroundDark: Color,
    val onBackgroundDark: Color,
    val surfaceDark: Color,
    val onSurfaceDark: Color,
    val error: Color,
    val onError: Color
)

val Ocean = ThemePalette(
    primary = Color(0xFF3B82A0),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFC7E8F0),
    onPrimaryContainer = Color(0xFF1A3B48),
    secondary = Color(0xFF5B8C9E),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD3E6ED),
    onSecondaryContainer = Color(0xFF2C4F5E),
    backgroundLight = Color(0xFFF4F4F0),
    onBackgroundLight = Color(0xFF2C2C2A),
    surfaceLight = Color(0xFFFCFCF9),
    onSurfaceLight = Color(0xFF2C2C2A),
    backgroundDark = Color(0xFF1C1C1A),
    onBackgroundDark = Color(0xFFE5E5E0),
    surfaceDark = Color(0xFF2A2A27),
    onSurfaceDark = Color(0xFFE5E5E0),
    error = Color(0xFFD9524D),
    onError = Color.White
)

val Forest = ThemePalette(
    primary = Color(0xFF5A8F6C),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD4E8D4),
    onPrimaryContainer = Color(0xFF2A4A34),
    secondary = Color(0xFF8FAA7B),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE0ECD6),
    onSecondaryContainer = Color(0xFF415233),
    backgroundLight = Color(0xFFF6F4EE),
    onBackgroundLight = Color(0xFF2D2D28),
    surfaceLight = Color(0xFFFDFCF7),
    onSurfaceLight = Color(0xFF2D2D28),
    backgroundDark = Color(0xFF1D1E1A),
    onBackgroundDark = Color(0xFFE6E5DD),
    surfaceDark = Color(0xFF2B2C26),
    onSurfaceDark = Color(0xFFE6E5DD),
    error = Color(0xFFC94F4F),
    onError = Color.White
)

val Dusk = ThemePalette(
    primary = Color(0xFF8B6FA8),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE5D6F0),
    onPrimaryContainer = Color(0xFF463557),
    secondary = Color(0xFFB089A3),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFEDDCE6),
    onSecondaryContainer = Color(0xFF5E4252),
    backgroundLight = Color(0xFFF3F2F4),
    onBackgroundLight = Color(0xFF2C2B2D),
    surfaceLight = Color(0xFFFCFBFC),
    onSurfaceLight = Color(0xFF2C2B2D),
    backgroundDark = Color(0xFF1C1B1D),
    onBackgroundDark = Color(0xFFE5E3E6),
    surfaceDark = Color(0xFF2A292C),
    onSurfaceDark = Color(0xFFE5E3E6),
    error = Color(0xFFCF5C5C),
    onError = Color.White
)

val Rose = ThemePalette(
    primary = Color(0xFFC47A9E),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFF3DAE6),
    onPrimaryContainer = Color(0xFF653A54),
    secondary = Color(0xFFD4A0B5),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFF5E4EC),
    onSecondaryContainer = Color(0xFF70465C),
    backgroundLight = Color(0xFFFDF5F7),
    onBackgroundLight = Color(0xFF2E2B2C),
    surfaceLight = Color(0xFFFFFAFB),
    onSurfaceLight = Color(0xFF2E2B2C),
    backgroundDark = Color(0xFF1F1B1D),
    onBackgroundDark = Color(0xFFE7E2E4),
    surfaceDark = Color(0xFF2E292C),
    onSurfaceDark = Color(0xFFE7E2E4),
    error = Color(0xFFD9524D),
    onError = Color.White
)

val Slate = ThemePalette(
    primary = Color(0xFF6B7F8F),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD6E0E8),
    onPrimaryContainer = Color(0xFF33424E),
    secondary = Color(0xFF8F9BA6),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE0E6EC),
    onSecondaryContainer = Color(0xFF47535E),
    backgroundLight = Color(0xFFF2F4F6),
    onBackgroundLight = Color(0xFF2A2D30),
    surfaceLight = Color(0xFFFBFCFD),
    onSurfaceLight = Color(0xFF2A2D30),
    backgroundDark = Color(0xFF1A1C1E),
    onBackgroundDark = Color(0xFFE3E5E8),
    surfaceDark = Color(0xFF282A2D),
    onSurfaceDark = Color(0xFFE3E5E8),
    error = Color(0xFFD9524D),
    onError = Color.White
)

val Sunset = ThemePalette(
    primary = Color(0xFFD4805A),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFF5E0D4),
    onPrimaryContainer = Color(0xFF6E3D27),
    secondary = Color(0xFFE8A77E),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFF7E6DA),
    onSecondaryContainer = Color(0xFF7A4930),
    backgroundLight = Color(0xFFFDF6F0),
    onBackgroundLight = Color(0xFF2E2B28),
    surfaceLight = Color(0xFFFFFBF7),
    onSurfaceLight = Color(0xFF2E2B28),
    backgroundDark = Color(0xFF1F1C19),
    onBackgroundDark = Color(0xFFE8E4DE),
    surfaceDark = Color(0xFF2E2A26),
    onSurfaceDark = Color(0xFFE8E4DE),
    error = Color(0xFFD9524D),
    onError = Color.White
)

val allThemes: Map<String, ThemePalette> = mapOf(
    "Ocean" to Ocean,
    "Forest" to Forest,
    "Dusk" to Dusk,
    "Sunset" to Sunset,
    "Slate" to Slate,
    "Rose" to Rose
)
