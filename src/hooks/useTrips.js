import { useState, useEffect, useCallback } from 'react'
import { getTrips, saveTrip, deleteTrip } from '../lib/indexeddb'
import { syncFromCloud, syncToCloud } from '../lib/sync'

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
    // 1. 먼저 로컬 데이터 표시
    load().then(async () => {
      // 2. 클라우드에서 pull → 로컬 머지 → UI 갱신
      if (navigator.onLine) {
        await syncFromCloud()
        await load()
        // 3. 로컬 변경사항 push
        await syncToCloud()
      }
    })
  }, [load])

  const addTrip = async (trip) => {
    const record = await saveTrip({
      id: trip.id || crypto.randomUUID(),
      ...trip,
    })
    await load()
    return record
  }

  const removeTrip = async (id) => {
    await deleteTrip(id)
    await load()
  }

  return { trips, loading, addTrip, removeTrip, reload: load }
}
