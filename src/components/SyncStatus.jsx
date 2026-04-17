import { useEffect, useState } from 'react'
import { getSyncQueue, clearAllData, clearSyncQueue } from '../lib/indexeddb'
import { supabase, wipeAllCloudData } from '../lib/supabase'

// 동기화 상태 바
// — 평소엔 숨김, 문제가 있을 때만 자동 노출 (오프라인 / 큐 쌓임 / 에러)
// — URL에 ?debug=1 달면 항상 표시 (비상용)
export default function SyncStatus() {
  const [queueSize, setQueueSize] = useState(0)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [lastError, setLastError] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const refresh = async () => {
      try {
        const q = await getSyncQueue()
        setQueueSize(q.length)
      } catch {}
    }
    refresh()
    const id = setInterval(refresh, 2000)

    const onOn = () => setOnline(true)
    const onOff = () => setOnline(false)
    window.addEventListener('online', onOn)
    window.addEventListener('offline', onOff)

    // 전역 에러 캡처 (sync.js가 console.error로 찍는 push 실패만)
    const origErr = console.error
    console.error = function (...args) {
      const msg = args.map(a => {
        if (typeof a === 'string') return a
        try { return JSON.stringify(a) } catch { return String(a) }
      }).join(' ')
      if (/push 실패|upsertTrip|sync/i.test(msg)) {
        setLastError(msg.slice(0, 500))
      }
      return origErr.apply(console, args)
    }

    return () => {
      clearInterval(id)
      window.removeEventListener('online', onOn)
      window.removeEventListener('offline', onOff)
      console.error = origErr
    }
  }, [])

  // 평소엔 조용히 — 오프라인 / 큐 쌓임 / 에러 / ?debug=1 일 때만 노출
  const debugMode = typeof location !== 'undefined' && /[?&]debug=1/.test(location.search)
  const hasIssue = !online || queueSize > 0 || lastError
  if (!hasIssue && !open && !debugMode) return null

  const bg = !online ? '#fef3c7' : lastError ? '#fee2e2' : queueSize > 0 ? '#dbeafe' : '#d1fae5'
  const fg = !online ? '#92400e' : lastError ? '#991b1b' : queueSize > 0 ? '#1e40af' : '#065f46'

  async function hardClear() {
    if (!confirm('로컬 데이터와 캐시를 전부 비웁니다. 계속?')) return
    try {
      await clearAllData()
      await clearSyncQueue()
    } catch (e) { console.warn('[hardClear clearStores]', e) }
    try { localStorage.removeItem('triply_disable_sync') } catch {}
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
    } catch (e) { console.warn('[hardClear caches]', e) }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
    } catch (e) { console.warn('[hardClear sw]', e) }
    try {
      const r = indexedDB.deleteDatabase('triply')
      await new Promise(res => {
        r.onsuccess = r.onerror = () => res()
        setTimeout(res, 500)
      })
    } catch {}
    alert('로컬 초기화 완료 — 새로고침합니다')
    location.replace(location.origin + location.pathname)
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '6px 12px',
        fontSize: 12,
        background: bg,
        color: fg,
        borderBottom: `1px solid ${fg}33`,
        cursor: 'pointer',
      }}
      onClick={() => setOpen(o => !o)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>
          {!online && '📴 오프라인'}
          {online && !supabase && '☁️ Supabase 미연결 (로컬 전용)'}
          {online && supabase && queueSize > 0 && `⏳ 동기화 대기 ${queueSize}건`}
          {online && supabase && queueSize === 0 && !lastError && '✅ 동기화 완료'}
          {lastError && ' • 🚨 에러'}
        </span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5 }}>
          <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ 설정됨' : '❌ 없음'}</div>
          <div>Anon Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ 설정됨' : '❌ 없음'}</div>
          <div>supabase client: {supabase ? '✅ 생성됨' : '❌ null'}</div>
          <div>큐 대기: <b>{queueSize}건</b> / 온라인: {online ? '예' : '아니오'}</div>
          {lastError && (
            <pre style={{
              marginTop: 6, padding: 6, background: '#fff', color: '#991b1b',
              fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 200, overflow: 'auto',
            }}>{lastError}</pre>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <button
              onClick={(e) => { e.stopPropagation(); hardClear() }}
              style={{
                padding: '6px 12px', background: '#dc2626',
                color: '#fff', border: 'none', borderRadius: 4, fontSize: 11,
                cursor: 'pointer', fontWeight: 600,
              }}
            >🧨 완전 초기화 (SW/캐시/IndexedDB 전부 삭제)</button>
            <button
              onClick={async (e) => {
                e.stopPropagation()
                if (!confirm('☁️ Supabase의 모든 trip/footprint를 삭제합니다. 계속?')) return
                try {
                  const res = await wipeAllCloudData()
                  alert(`클라우드 삭제 완료: trips ${res.trips}건, footprints ${res.footprints}건`)
                } catch (err) {
                  alert('실패: ' + (err.message || err))
                }
              }}
              style={{
                padding: '6px 12px', background: '#7c3aed',
                color: '#fff', border: 'none', borderRadius: 4, fontSize: 11,
                cursor: 'pointer', fontWeight: 600,
              }}
              disabled={!supabase}
            >☁️ 클라우드 데이터 전부 삭제</button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const on = localStorage.getItem('triply_disable_sync') === '1'
                if (on) {
                  localStorage.removeItem('triply_disable_sync')
                  alert('동기화 ON — 새로고침합니다')
                } else {
                  localStorage.setItem('triply_disable_sync', '1')
                  alert('동기화 OFF (로컬 전용) — 새로고침합니다')
                }
                location.reload()
              }}
              style={{
                padding: '6px 12px', background: '#0891b2',
                color: '#fff', border: 'none', borderRadius: 4, fontSize: 11,
                cursor: 'pointer', fontWeight: 600,
              }}
            >🔌 동기화 {localStorage.getItem('triply_disable_sync') === '1' ? 'ON' : 'OFF'} 토글</button>
          </div>
        </div>
      )}
    </div>
  )
}
