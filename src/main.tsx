import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTheme } from './theme/applyTheme'
import './theme/global.css'
import App from './App.tsx'

applyTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
