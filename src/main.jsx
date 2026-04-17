import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { startAutoSync } from './lib/sync'
import './index.css'

// 🔄 PWA: 새 Service Worker가 활성화되면 즉시 페이지 새로고침
// (모바일에서 구 버전 JS가 캐시돼 계속 실행되는 문제 방지)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

startAutoSync()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
