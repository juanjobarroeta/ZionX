import './sentry'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// The service worker exists for push and nothing else — it caches no assets,
// so it can never hand the browser a stale index.html. Registering it costs
// nothing and asks the person for nothing; permission is requested only from
// the "Activar avisos" button.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Chrome offers to install the app once, early. Hold on to the event so the
// "Instalar la app" button can use it whenever the person reaches it.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__zxInstallPrompt = e
  window.dispatchEvent(new Event('zx-installable'))
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
