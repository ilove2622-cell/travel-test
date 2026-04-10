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
      if (!local) {
        // 로컬에 없으면 그대로 저장
        await saveTrip({ ...ct, updatedAt: Date.now() }, { skipSync: true })
      } else {
        // 로컬에 있으면 team_data(정산/투표)만 클라우드 기준으로 머지 (photos는 로컬 전용)
        let needsUpdate = false
        const merged = { ...local }
        for (const field of ['expenses', 'votes']) {
          const cloudArr = ct[field] || []
          const localArr = local[field] || []
          if (JSON.stringify(cloudArr) !== JSON.stringify(localArr)) {
            merged[field] = cloudArr
            needsUpdate = true
          }
        }
        if (needsUpdate) {
          await saveTrip({ ...merged, updatedAt: Date.now() }, { skipSync: true })
        }
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
