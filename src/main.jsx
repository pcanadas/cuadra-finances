import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppLock from './components/AppLock.mobile'
import { initInsets } from './platform/insets'
import { initTextSize } from './platform/textSize'

initInsets()
initTextSize()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppLock>
      <App />
    </AppLock>
  </StrictMode>,
)
