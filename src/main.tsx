import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The two fonts ship with the game, so it looks the same on every computer and works offline.
import '@fontsource-variable/fredoka'
import '@fontsource-variable/nunito'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
