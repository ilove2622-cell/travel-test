import { openDB } from 'idb'

const DB_NAME = 'triply'
const DB_VERSION = 3

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 여행 저장소
      if (!db.objectStoreNames.contains('trips')) {
        const tripStore = db.createObjectStore('trips', { keyPath: 'id' })
        tripStore.createIndex('status', 'status')
        tripStore.createIndex('updatedAt', 'updatedAt')
      }

      // 발자취(방문 기록) 저장소
      if (!db.objectStoreNames.contains('footprints')) {
        const fpStore = db.createObjectStore('footprints', { keyPath: 'id' })
        fpStore.createIndex('country', 'country')
        fpStore.createIndex('visitDate', 'visitDate')
      }

      // 동기화 큐 (오프라인 변경사항 추적)
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true })
        syncStore.createIndex('createdAt', 'createdAt')
      }

      // 사용자 설정 저장소
      if (!db.objectStoreNames.contains('userPrefs')) {
        db.createObjectStore('userPrefs', { keyPath: 'id' })
      }

      // 팀 데이터 (정산/투표/사진)
      if (!db.objectStoreNames.contains('teamData')) {
        const teamStore = db.createObjectStore('teamData', { keyPath: 'id', autoIncrement: true })
        teamStore.createIndex('type', 'type')
        teamStore.createIndex('tripId', 'tripId')
      }
    },
  })
}

// ── 여행 CRUD ──

export async function getTrips() {
  const db = await getDB()
  return db.getAll('trips')
}

export async function getTrip(id) {
  const db = await getDB()
  return db.get('trips', id)
}

export async function saveTrip(trip, { skipSync = false } = {}) {
  const db = await getDB()
  const record = {
    ...trip,
    updatedAt: Date.now(),
    synced: skipSync,
  }
  await db.put('trips', record)
  if (!skipSync) {
    await addToSyncQueue('trips', 'upsert', record)
    // 🚀 즉시 동기화 트리거 (페이지가 온라인일 때만)
    if (typeof window !== 'undefined' && navigator.onLine) {
      // sync.js의 즉시 push 함수 호출 (순환 참조 방지: 이벤트로 전달)
      window.dispatchEvent(new CustomEvent('triply:sync-needed'))
    }
  }
  return record
}

export async function deleteTrip(id) {
  const db = await getDB()
  await db.delete('trips', id)
  await addToSyncQueue('trips', 'delete', { id })
}

// 🔒 원자적 업데이트: 한 IndexedDB 트랜잭션 안에서 read → modify → write
//    외부 sync가 이 사이에 끼어들어 덮어쓰는 race condition을 차단
export async function atomicUpdateTripField(tripId, field, updater, { skipSync = false } = {}) {
  const db = await getDB()
  const tx = db.transaction('trips', 'readwrite')
  const store = tx.objectStore('trips')
  const current = await store.get(tripId)
  if (!current) {
    await tx.done
    return null
  }
  const arr = current[field] || []
  const nextArr = updater(arr)
  const record = {
    ...current,
    [field]: nextArr,
    updatedAt: Date.now(),
    synced: skipSync,
  }
  await store.put(record)
  await tx.done

  // 트랜잭션 완료 후 큐 처리
  if (!skipSync) {
    await addToSyncQueue('trips', 'upsert', record)
    if (typeof window !== 'undefined' && navigator.onLine) {
      window.dispatchEvent(new CustomEvent('triply:sync-needed'))
    }
  }
  return record
}

// 🔒 원자적 머지: cloud → local 병합도 한 트랜잭션에서 수행 (race 차단)
//    mergeFn(localArr, cloudArr) → 새 배열
//    반환: { changed: boolean, record: updatedTrip | null }
export async function atomicMergeTripField(tripId, field, cloudArr, mergeFn) {
  const db = await getDB()
  const tx = db.transaction('trips', 'readwrite')
  const store = tx.objectStore('trips')
  const current = await store.get(tripId)
  if (!current) {
    await tx.done
    return { changed: false, record: null }
  }
  const localArr = current[field] || []
  const mergedArr = mergeFn(localArr, cloudArr)

  // ID 기준으로 비교 — 배열 크기 또는 개별 updatedAt이 다를 때만 실제 쓰기
  const changed = localArr.length !== mergedArr.length ||
    mergedArr.some(m => {
      const l = localArr.find(x => x?.id === m?.id)
      return !l || (l.updatedAt || 0) !== (m.updatedAt || 0)
    })

  if (!changed) {
    await tx.done
    return { changed: false, record: current }
  }

  const record = {
    ...current,
    [field]: mergedArr,
    updatedAt: Date.now(),
    synced: true, // 클라우드에서 왔으므로 이미 sync됨
  }
  await store.put(record)
  await tx.done
  return { changed: true, record }
}

// ── 발자취 CRUD ──

export async function getFootprints() {
  const db = await getDB()
  return db.getAll('footprints')
}

export async function saveFootprint(footprint) {
  const db = await getDB()
  const record = {
    ...footprint,
    updatedAt: Date.now(),
    synced: false,
  }
  await db.put('footprints', record)
  await addToSyncQueue('footprints', 'upsert', record)
  return record
}

// ── 동기화 큐 ──

async function addToSyncQueue(store, action, data) {
  const db = await getDB()
  await db.add('syncQueue', {
    store,
    action,
    data,
    createdAt: Date.now(),
  })
}

export async function getSyncQueue() {
  const db = await getDB()
  return db.getAll('syncQueue')
}

export async function clearSyncQueue() {
  const db = await getDB()
  await db.clear('syncQueue')
}

export async function removeSyncItem(id) {
  const db = await getDB()
  await db.delete('syncQueue', id)
}

// ── 사용자 설정 CRUD ──

export async function getUserPref(id) {
  const db = await getDB()
  return db.get('userPrefs', id)
}

export async function saveUserPref(id, data) {
  const db = await getDB()
  await db.put('userPrefs', { id, ...data, updatedAt: Date.now() })
}

// ── 팀 데이터 CRUD ──

export async function getTeamData(type, tripId) {
  const db = await getDB()
  const all = await db.getAll('teamData')
  return all.filter(d => d.type === type && (!tripId || d.tripId === tripId))
}

export async function saveTeamData(item) {
  const db = await getDB()
  const record = { ...item, updatedAt: Date.now() }
  const id = await db.put('teamData', record)
  return { ...record, id }
}

export async function deleteTeamData(id) {
  const db = await getDB()
  await db.delete('teamData', id)
}

// ── 전체 데이터 내보내기 (백업용) ──

export async function exportAll() {
  const db = await getDB()
  return {
    trips: await db.getAll('trips'),
    footprints: await db.getAll('footprints'),
    userPrefs: await db.getAll('userPrefs'),
  }
}

// ── 전체 데이터 초기화 ──

export async function clearAllData() {
  const db = await getDB()
  await db.clear('trips')
  await db.clear('footprints')
  await db.clear('syncQueue')
  await db.clear('userPrefs')
}
