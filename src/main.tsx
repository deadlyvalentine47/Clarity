import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { PreferencesProvider } from './context/PreferencesContext'
import './styles.css'

// The Android WebView has no server to fall back to index.html, so deep
// links use hash routing there. The browser keeps clean URLs.
const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </Router>
  </StrictMode>,
)
