import { useEffect, useState } from 'react'
import { getSyncQueue } from '../lib/indexeddb'
import { supabase, wipeAllCloudData } from '../lib/supabase'

// 빌드 확인용 버전 — 새 JS가 실제로 로드됐는지 눈으로 확인
const BUILD_TAG = 'v8-cloud-wipe'

// 동기화 상태 바: 대기 중인 큐 수와 최근 에러를 항상 표시
// — 핸드폰에서 왜 클라우드에 반영되지 않는지 즉시 파악 가능
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

    // 전역 에러 캡처 (sync.js가 console.error로 찍는 메시지 중 push 실패만)
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

  // 🔬 진단 모드: 상태 바 항상 노출 (문제 원인이 잡힐 때까지)
  const bg = !online ? '#fef3c7' : lastError ? '#fee2e2' : queueSize > 0 ? '#dbeafe' : '#d1fae5'
  const fg = !online ? '#92400e' : lastError ? '#991b1b' : queueSize > 0 ? '#1e40af' : '#065f46'

  async function hardClear() {
    if (!confirm('로컬 데이터와 캐시를 전부 비웁니다. 계속?')) return
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      // IndexedDB 전체 삭제
      const dbs = await (indexedDB.databases ? indexedDB.databases() : Promise.resolve([{ name: 'triply' }]))
      await Promise.all((dbs || []).map(d => new Promise(res => {
        const r = indexedDB.deleteDatabase(d.name)
        r.onsuccess = r.onerror = r.onblocked = () => res()
      })))
    } catch (e) { console.warn('[hardClear]', e) }
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
          [{BUILD_TAG}]{' '}
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
          <div>빌드: <b>{BUILD_TAG}</b></div>
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
