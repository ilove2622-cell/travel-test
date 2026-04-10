import { useState, useEffect, useCallback } from 'react'
import { getTrips, saveTrip, deleteTrip } from '../lib/indexeddb'

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

  useEffect(() => { load() }, [load])

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
