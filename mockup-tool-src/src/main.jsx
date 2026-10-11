import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// iOS Safari ignores user-scalable=no; stop its page-level pinch so only the
// canvas stage (ZoomStage) zooms.
document.addEventListener('gesturestart', (e) => e.preventDefault())

// iOS home-screen (standalone) apps can report a layout viewport shorter than the
// screen, leaving a strip under the app. Measure the real height and let the
// full-screen shells use it. Everywhere else the CSS falls back to inset: 0.
const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
const syncAppHeight = () => {
  const portrait = window.innerHeight > window.innerWidth
  const h = standalone && portrait ? Math.max(window.innerHeight, window.screen.height) : null
  if (h) document.documentElement.style.setProperty('--app-h', `${h}px`)
  else document.documentElement.style.removeProperty('--app-h')
}
syncAppHeight()
window.addEventListener('resize', syncAppHeight)
window.addEventListener('orientationchange', syncAppHeight)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
