import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// iOS Safari ignores user-scalable=no; stop its page-level pinch so only the
// canvas stage (ZoomStage) zooms.
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) =>
  document.addEventListener(type, (e) => e.preventDefault()),
)

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
