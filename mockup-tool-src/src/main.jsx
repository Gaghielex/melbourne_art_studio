import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// iOS Safari ignores user-scalable=no; stop its page-level pinch so only the
// canvas stage (ZoomStage) zooms.
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) =>
  document.addEventListener(type, (e) => e.preventDefault()),
)

// The home screen is laid out at the device's full screen height (not the
// viewport's), so its carousel never resizes if iOS corrects the viewport after
// launch; the viewport simply reveals more of an already full-height layout.
const syncScreenHeight = () => {
  const portrait = window.innerHeight > window.innerWidth
  const h = portrait ? Math.max(window.screen.height, window.innerHeight) : window.innerHeight
  document.documentElement.style.setProperty('--screen-h', `${h}px`)
}
syncScreenHeight()
window.addEventListener('resize', syncScreenHeight)
window.addEventListener('orientationchange', () => setTimeout(syncScreenHeight, 300))

// Launching from the iOS home screen can leave the viewport short until the first
// scroll gesture. Nudge the page by 1px to trigger the same correction ourselves.
const nudgeViewport = () => {
  window.scrollTo({ top: 1, behavior: 'instant' })
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }))
}
window.addEventListener('load', () => [0, 150, 500].forEach((ms) => setTimeout(nudgeViewport, ms)))
window.addEventListener('pageshow', nudgeViewport)
window.addEventListener('orientationchange', () => setTimeout(nudgeViewport, 300))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
