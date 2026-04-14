import { getSyncQueue, removeSyncItem, getTrips, saveTrip } from './indexeddb'
import { supabase, upsertTrip, removeTrip, upsertFootprint, fetchTrips } from './supabase'

let syncing = false
let pushDebounceTimer = null

// 🔀 ID 기준 머지: 양쪽 배열을 합치되 updatedAt이 더 최신인 것 우선
//    - 같은 ID가 있으면 updatedAt이 큰 쪽 선택
//    - 한쪽에만 있으면 그대로 유지 (삭제된 것으로 간주하지 않음 — 새로 추가된 것으로 봄)
function mergeById(localArr, cloudArr) {
  const map = new Map()
  // 먼저 로컬 저장
  for (const item of localArr || []) {
    if (item?.id) map.set(item.id, item)
  }
  // 클라우드 순회: 같은 ID면 updatedAt 비교, 없으면 추가
  for (const item of cloudArr || []) {
    if (!item?.id) continue
    const existing = map.get(item.id)
    if (!existing) {
      map.set(item.id, item)
    } else {
      const lu = existing.updatedAt || 0
      const cu = item.updatedAt || 0
      if (cu > lu) map.set(item.id, item)
    }
  }
  // updatedAt 최신순 정렬
  return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

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
        // 🔀 team_data(expenses/votes)는 **개별 ID 기준으로 머지** — 동시 수정 충돌 방지
        let needsUpdate = false
        const merged = { ...local }

        for (const field of ['expenses', 'votes']) {
          const cloudArr = ct[field] || []
          const localArr = local[field] || []
          const mergedArr = mergeById(localArr, cloudArr)
          if (JSON.stringify(mergedArr) !== JSON.stringify(localArr)) {
            merged[field] = mergedArr
            needsUpdate = true
          }
        }

        if (needsUpdate) {
          await saveTrip({ ...merged, updatedAt: Date.now() }, { skipSync: true })
          // 머지 결과가 클라우드와 다르면 다시 push 필요 (로컬에 있던 우리만의 수정 보존)
          window.dispatchEvent(new CustomEvent('triply:sync-needed'))
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
    console.log(`[sync] push 시작 — 큐: ${queue.length}건`)
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
        console.log(`[sync] push 성공: ${item.store}/${item.action}`)
      } catch (err) {
        console.error(`[sync] 🚨 push 실패:`, {
          store: item.store,
          action: item.action,
          error: err.message,
          details: err,
          data: item.data,
        })
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
