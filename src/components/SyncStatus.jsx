import { useEffect, useState } from 'react'
import { getSyncQueue } from '../lib/indexeddb'
import { supabase } from '../lib/supabase'

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

  // 평소엔 문제 없으면 조용히 — 문제 생기면 눈에 띄게
  const hasIssue = !online || queueSize > 0 || lastError
  if (!hasIssue && !open) return null

  const bg = !online ? '#fef3c7' : lastError ? '#fee2e2' : queueSize > 0 ? '#dbeafe' : '#d1fae5'
  const fg = !online ? '#92400e' : lastError ? '#991b1b' : queueSize > 0 ? '#1e40af' : '#065f46'

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
          {lastError && ' • 에러 있음'}
        </span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && lastError && (
        <pre style={{
          marginTop: 6,
          padding: 6,
          background: '#fff',
          color: '#991b1b',
          fontSize: 10,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 200,
          overflow: 'auto',
        }}>
          {lastError}
        </pre>
      )}
      {open && !lastError && (
        <div style={{ marginTop: 6, fontSize: 11 }}>
          Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '설정됨' : '❌ 없음'}<br/>
          Anon Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '설정됨' : '❌ 없음'}<br/>
          큐 대기: {queueSize}건 / 온라인: {online ? '예' : '아니오'}
        </div>
      )}
    </div>
  )
}
