import { useState, useEffect, useCallback } from 'react'
import { getTrips, getTrip, saveTrip, deleteTrip } from '../lib/indexeddb'

export default function useTrips() {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await getTrips()
      setTrips(data.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)))
    } catch (err) {
      console.error('[useTrips] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 로컬 데이터 즉시 표시 (클라우드 동기화는 startAutoSync가 전담)
    load()

    // 🛰️ 클라우드 동기화 완료 이벤트 수신 → 로컬 재로드
    const handler = () => load()
    window.addEventListener('triply:data-updated', handler)
    return () => window.removeEventListener('triply:data-updated', handler)
  }, [load])

  const addTrip = async (trip) => {
    const id = trip.id || crypto.randomUUID()
    // 🛡️ 이미 존재하는 여행은 덮어쓰지 않음 (사용자 데이터 보호)
    let existing = await getTrip(id)
    if (!existing && trip.title) {
      // 🔄 ID 마이그레이션: 이전 버전에서 string id('dalian-2025-06' 등)로 저장된
      //    같은 여행이 있으면 중복 생성 방지 (title 기준 탐색)
      const allTrips = await getTrips()
      existing = allTrips.find(t => t.title === trip.title && t.destination === trip.destination)
    }
    if (existing) {
      await load()
      return existing
    }
    const record = await saveTrip({ id, ...trip })
    await load()
    return record
  }

  const removeTrip = async (id) => {
    await deleteTrip(id)
    await load()
  }

  return { trips, loading, addTrip, removeTrip, reload: load }
}
