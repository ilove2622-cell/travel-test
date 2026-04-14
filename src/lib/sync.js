import { getSyncQueue, removeSyncItem, getTrips, saveTrip } from './indexeddb'
import { supabase, upsertTrip, removeTrip, upsertFootprint, fetchTrips } from './supabase'

let syncing = false
let pushDebounceTimer = null

// Cloud → Local 동기화 (pull)
export async function syncFromCloud() {
  if (!supabase) return
  if (!navigator.onLine) return

  try {
    // 🛡️ pull 전에 미동기화 로컬 변경사항이 있으면 스킵 (덮어쓰기 방지)
    const pendingQueue = await getSyncQueue()
    if (pendingQueue && pendingQueue.length > 0) {
      console.log('[sync] 미동기화 큐 존재 — pull 연기')
      return
    }

    const cloudTrips = await fetchTrips()
    const localTrips = await getTrips()
    const localMap = new Map(localTrips.map(t => [t.id, t]))

    for (const ct of cloudTrips) {
      const local = localMap.get(ct.id)
      if (!local) {
        // 로컬에 없으면 그대로 저장
        await saveTrip({ ...ct, updatedAt: Date.now() }, { skipSync: true })
      } else {
        // 🛡️ 로컬이 더 최신이면 덮어쓰기 금지 (updated_at 비교)
        const cloudUpdated = ct.updated_at ? new Date(ct.updated_at).getTime() : 0
        const localUpdated = local.updatedAt || 0
        if (localUpdated > cloudUpdated) continue

        // 로컬에 있고 클라우드가 더 최신이면 team_data(정산/투표)만 머지 (photos는 로컬 전용)
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
          await saveTrip({ ...merged, updatedAt: cloudUpdated || Date.now() }, { skipSync: true })
          // 다른 컴포넌트에게 "데이터 갱신됨" 알림
          window.dispatchEvent(new CustomEvent('triply:data-updated', { detail: { tripId: ct.id } }))
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

// push → pull 순서로 동기화
async function pushThenPull() {
  await syncToCloud()
  await syncFromCloud()
}

// 🚀 즉시 push (debounced: 연속된 수정을 묶어서 500ms 후 한번에 push)
function schedulePush() {
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer)
  pushDebounceTimer = setTimeout(() => {
    if (navigator.onLine) syncToCloud()
  }, 500)
}

// 🛰️ Supabase Realtime: 다른 사용자의 클라우드 변경을 실시간으로 받음
function subscribeRealtime() {
  if (!supabase) return
  const channel = supabase
    .channel('trips-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trips' },
      async (payload) => {
        console.log('[sync] 실시간 변경 감지:', payload.eventType)
        // 다른 기기/사용자가 변경 → 바로 pull해서 로컬 갱신
        await syncFromCloud()
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[sync] Realtime 구독 활성화')
      }
    })
  return channel
}

// 네트워크 복구 시 자동 동기화
export function startAutoSync() {
  // 🚀 로컬 수정 감지 → 즉시 push
  window.addEventListener('triply:sync-needed', schedulePush)

  window.addEventListener('online', () => {
    console.log('[sync] 네트워크 복구 — 동기화 시작')
    pushThenPull()
  })

  // 🛰️ Supabase Realtime 구독
  subscribeRealtime()

  // 백업용 주기적 동기화 (30초 — 기존 5분에서 단축)
  setInterval(() => {
    if (navigator.onLine) pushThenPull()
  }, 30 * 1000)

  // 페이지 포커스 시 동기화 (탭 전환 후 돌아왔을 때)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      pushThenPull()
    }
  })

  // 초기 동기화: push → pull
  if (navigator.onLine) {
    pushThenPull()
  }
}
