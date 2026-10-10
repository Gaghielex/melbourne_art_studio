import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// iOS Safari ignores user-scalable=no; stop its page-level pinch so only the
// canvas stage (ZoomStage) zooms.
document.addEventListener('gesturestart', (e) => e.preventDefault())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
