import { getSyncQueue, removeSyncItem } from './indexeddb'
import { supabase, upsertTrip, removeTrip, upsertFootprint } from './supabase'

let syncing = false

export async function syncToCloud() {
  if (!supabase || syncing) return
  if (!navigator.onLine) return

  syncing = true
  try {
    const queue = await getSyncQueue()
    for (const item of queue) {
      try {
        if (item.store === 'trips') {
          if (item.action === 'upsert') await upsertTrip(item.data)
          if (item.action === 'delete') await removeTrip(item.data.id)
        }
        if (item.store === 'footprints') {
          if (item.action === 'upsert') await upsertFootprint(item.data)
        }
        await removeSyncItem(item.id)
      } catch (err) {
        console.warn('[sync] 항목 동기화 실패:', item.id, err.message)
        break // 순서 보장을 위해 실패 시 중단
      }
    }
  } finally {
    syncing = false
  }
}

// 네트워크 복구 시 자동 동기화
export function startAutoSync() {
  window.addEventListener('online', () => {
    console.log('[sync] 네트워크 복구 — 동기화 시작')
    syncToCloud()
  })

  // 주기적 동기화 (5분)
  setInterval(() => {
    if (navigator.onLine) syncToCloud()
  }, 5 * 60 * 1000)

  // 초기 동기화
  if (navigator.onLine) syncToCloud()
}
