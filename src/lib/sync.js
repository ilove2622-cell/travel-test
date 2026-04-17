import { getSyncQueue, removeSyncItem, getTrips, getTrip, saveTrip, atomicMergeTripField } from './indexeddb'
import { supabase, upsertTrip, removeTrip, upsertFootprint, fetchTrips } from './supabase'

let syncing = false
let syncingFromCloud = false
let pushDebounceTimer = null

// UUID 형식 검증 (Supabase의 id UUID PRIMARY KEY와 호환 여부 확인)
function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '')
}

// 🔀 ID 기준 머지: 양쪽 배열을 합치되 updatedAt이 더 최신인 것 우선
//    - id 없는 legacy 아이템은 즉석에서 uuid 부여해 보존 (이전엔 drop되어 데이터 손실)
//    - 같은 ID가 있으면 updatedAt이 큰 쪽 선택
//    - 한쪽에만 있으면 그대로 유지 (삭제된 것으로 간주하지 않음)
function mergeById(localArr, cloudArr) {
  const map = new Map()
  const ensureId = (item) => {
    if (!item) return null
    if (item.id) return item
    // id 없으면 내용 기반 지문 또는 uuid 부여 — 무조건 보존
    const synthId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`
    return { ...item, id: synthId }
  }
  // 먼저 로컬 저장
  for (const raw of localArr || []) {
    const item = ensureId(raw)
    if (item) map.set(item.id, item)
  }
  // 클라우드 순회: 같은 ID면 updatedAt 비교, 없으면 추가
  for (const raw of cloudArr || []) {
    const item = ensureId(raw)
    if (!item) continue
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
  if (syncingFromCloud) return   // 🛡️ 동시 실행 방지

  syncingFromCloud = true
  try {
    const cloudTrips = await fetchTrips()

    for (const ct of cloudTrips) {
      // 🛡️ 유령/불완전 레코드 스킵 — pull 건너뜀만, cloud 삭제는 하지 않음
      //    (자동 삭제가 실제 trip을 지우는 부작용 방지 — 사용자가 직접 관리)
      const isStub =
        !ct.title ||
        !ct.destination
      if (isStub) {
        console.warn('[sync] 불완전 cloud 레코드 스킵:', ct.id, ct.title || '(no title)')
        continue
      }

      const local = await getTrip(ct.id)

      if (!local) {
        // 🛡️ 로컬에 같은 title+destination trip이 이미 있으면 cloud 버전 무시
        //    (ID가 달라도 중복 trip 생성 방지)
        const allLocal = await getTrips()
        const dupe = allLocal.find(t => t.title === ct.title && t.destination === ct.destination)
        if (dupe) {
          console.warn('[sync] cloud trip의 title이 기존 local과 중복 → 스킵:', ct.id)
          continue
        }
        // 로컬에 없으면 클라우드 버전 저장 (다른 기기에서 만든 여행)
        await saveTrip({ ...ct, updatedAt: Date.now() }, { skipSync: true })
        window.dispatchEvent(new CustomEvent('triply:data-updated', { detail: { tripId: ct.id } }))
        continue
      }

      // 🔒 expenses / votes는 원자적 머지 (read-modify-write가 한 트랜잭션)
      //    → 이 사이에 user가 expense 추가해도 race 없음
      let anyChange = false
      for (const field of ['expenses', 'votes']) {
        const cloudArr = ct[field] || []
        if (cloudArr.length === 0) continue  // 클라우드에 아무것도 없으면 머지 skip
        const { changed } = await atomicMergeTripField(ct.id, field, cloudArr, mergeById)
        if (changed) anyChange = true
      }

      if (anyChange) {
        window.dispatchEvent(new CustomEvent('triply:sync-needed'))
        window.dispatchEvent(new CustomEvent('triply:data-updated', { detail: { tripId: ct.id } }))
      }
    }
    console.log('[sync] 클라우드에서 동기화 완료')
  } catch (err) {
    console.warn('[sync] pull 실패:', err.message)
  } finally {
    syncingFromCloud = false
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
          // 🛡️ non-UUID id(가이드 데이터 등)는 Supabase UUID 컬럼에 저장 불가
          // → 큐에서 제거하고 건너뜀 (로컬에는 정상 보존)
          if (!isValidUUID(item.data?.id)) {
            console.warn(`[sync] non-UUID id 스킵: ${item.data?.id}`)
            await removeSyncItem(item.id)
            continue
          }
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
          data: item.data?.id,
        })
        // 🔧 break → continue: 한 건 실패해도 나머지 큐는 계속 처리
        // (특정 아이템 영구 실패 시 다른 아이템이 막히지 않도록)
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
