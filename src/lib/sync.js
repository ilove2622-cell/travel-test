import { getSyncQueue, removeSyncItem, getTrips, saveTrip } from './indexeddb'
import { supabase, upsertTrip, removeTrip, upsertFootprint, fetchTrips } from './supabase'

let syncing = false

// Cloud → Local 동기화 (pull)
export async function syncFromCloud() {
  if (!supabase) return
  if (!navigator.onLine) return

  try {
    const cloudTrips = await fetchTrips()
    const localTrips = await getTrips()
    const localMap = new Map(localTrips.map(t => [t.id, t]))

    for (const ct of cloudTrips) {
      const local = localMap.get(ct.id)
      // 클라우드 데이터가 더 최신이거나 로컬에 없으면 업데이트
      if (!local || (ct.updated_at && (!local.updatedAt || new Date(ct.updated_at).getTime() > local.updatedAt))) {
        await saveTrip({ ...ct, updatedAt: new Date(ct.updated_at || Date.now()).getTime() }, { skipSync: true })
      }
    }
    console.log('[sync] 클라우드에서 동기화 완료')
  } catch (err) {
    console.warn('[sync] pull 실패:', err.message)
  }
}

// Local → Cloud 동기화 (push)
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
        break
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
    syncFromCloud().then(() => syncToCloud())
  })

  // 주기적 동기화 (5분)
  setInterval(() => {
    if (navigator.onLine) syncFromCloud().then(() => syncToCloud())
  }, 5 * 60 * 1000)

  // 초기 동기화: 먼저 pull → 그 다음 push
  if (navigator.onLine) {
    syncFromCloud().then(() => syncToCloud())
  }
}
