import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'
import { reloadForUpdate } from './lib/app-update'

// Vite tells us when a page of the app can't be loaded (a deploy renamed its files while this tab was open).
window.addEventListener('vite:preloadError', event => {
  event.preventDefault()
  reloadForUpdate()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
