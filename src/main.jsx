import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// In dev, unregister all service workers to prevent stale cache from breaking React hooks
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  }).catch(() => {});
}

// Auto dark mode based on system preference
function applyColorScheme(e) {
  document.documentElement.classList.toggle('dark', e.matches);
}
const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
applyColorScheme(darkMQ);
darkMQ.addEventListener('change', applyColorScheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)