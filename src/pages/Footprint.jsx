import { MapPin, Globe, Map, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useTrips from '../hooks/useTrips'
import useTwemoji from '../hooks/useTwemoji'
import './Footprint.css'

export default function Footprint() {
  const navigate = useNavigate()
  const { trips, loading } = useTrips()
  const emojiRef = useTwemoji()

  const completed = trips.filter(t => t.status === 'completed')
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))

  const countries = new Set(completed.map(t => t.countryCode).filter(Boolean))
  const cities = new Set(completed.map(t => t.destination).filter(Boolean))
  const totalDays = completed.reduce((sum, t) => {
    if (t.startDate && t.endDate) {
      const diff = (new Date(t.endDate) - new Date(t.startDate)) / (1000 * 60 * 60 * 24) + 1
      return sum + diff
    }
    return sum
  }, 0)

  return (
    <div className="footprint" ref={emojiRef}>
      <header className="footprint-header">
        <MapPin size={28} />
        <h1>나의 발자취</h1>
      </header>

      <div className="footprint-stats">
        <div className="footprint-stat">
          <span className="footprint-stat-value">{countries.size}</span>
          <span className="footprint-stat-label">방문 나라</span>
        </div>
        <div className="footprint-stat-divider" />
        <div className="footprint-stat">
          <span className="footprint-stat-value">{cities.size}</span>
          <span className="footprint-stat-label">방문 도시</span>
        </div>
        <div className="footprint-stat-divider" />
        <div className="footprint-stat">
          <span className="footprint-stat-value">{totalDays}</span>
          <span className="footprint-stat-label">총 여행일</span>
        </div>
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--gray-400)' }}>불러오는 중...</p>}

      {!loading && completed.length === 0 && (
        <div className="footprint-empty">
          <p>아직 기록된 발자취가 없어요</p>
          <p>여행을 다녀오면 여기에 표시됩니다</p>
        </div>
      )}

      {!loading && completed.length > 0 && (
        <div className="footprint-timeline">
          {completed.map(trip => (
            <div
              key={trip.id}
              className="footprint-trip-card"
              onClick={() => navigate(`/trip/${trip.id}`)}
            >
              <div className="footprint-trip-emoji">{trip.emoji || '✈️'}</div>
              <div className="footprint-trip-info">
                <h3>{trip.title}</h3>
                <div className="footprint-trip-meta">
                  <span><MapPin size={12} /> {trip.destination}</span>
                  <span><Calendar size={12} /> {trip.startDate} ~ {trip.endDate}</span>
                </div>
                {trip.schedule?.days && (
                  <span className="footprint-trip-days">
                    {trip.schedule.days.length}일간 {trip.schedule.days.reduce((s, d) => s + (d.schedule?.length || 0), 0)}개 일정
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
