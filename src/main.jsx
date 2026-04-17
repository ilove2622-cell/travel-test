import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { startAutoSync } from './lib/sync'
import './index.css'

// 🚨 killswitch: URL에 ?reset=1 이 있으면 SW/캐시/IndexedDB 큐 전부 비우고 루트로 이동
//    모바일에서 구버전 캐시로 멈춘 사용자 긴급 구제용
;(async () => {
  if (!/[?&]reset=1/.test(location.search)) return
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch (e) { console.warn('[reset] 실패:', e) }
  location.replace(location.origin + location.pathname)
})()

// 🔄 PWA: 새 Service Worker가 활성화되면 즉시 페이지 새로고침
//    + 로드 직후 강제 업데이트 체크 → 모바일 캐시 구버전 탈출
let __reloading = false
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (__reloading) return
    __reloading = true
    window.location.reload()
  })

  // 페이지 로드 후 강제 업데이트 확인 (registerType: autoUpdate 보조)
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => {
        reg.update().catch(() => {})
        // 이미 waiting 중인 새 SW 있으면 즉시 활성화
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      })
    }).catch(() => {})
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
