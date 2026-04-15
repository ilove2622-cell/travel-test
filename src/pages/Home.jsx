import { useState } from 'react'
import { Plus, MapPin, Calendar, Trash2, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useTwemoji from '../hooks/useTwemoji'
import useTrips from '../hooks/useTrips'
import PlaceLink from '../components/PlaceLink'
import dalianTrip from '../data/dalian-trip'
import qingdaoTrip from '../data/qingdao-trip'
import './Home.css'

const STATUS_LABEL = { upcoming: '예정', ongoing: '진행중', completed: '완료' }

export default function Home() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const emojiRef = useTwemoji()
  const { trips, loading, removeTrip, addTrip } = useTrips()
  const filtered = (filter === 'all'
    ? trips
    : trips.filter(t => t.status === filter)
  ).slice().sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))

  const formatDates = (t) => {
    if (t.dates) return t.dates
    if (t.startDate && t.endDate) return `${t.startDate} ~ ${t.endDate}`
    return ''
  }

  return (
    <div className="home" ref={emojiRef}>
      <header className="home-header">
        <h1>✈️ TRIPLY</h1>
        <p className="home-subtitle">나만의 여행을 시작하세요</p>
      </header>

      {/* 가이드 임포트 */}
      {!loading && !trips.some(t => t.id === qingdaoTrip.id) && (
        <div style={{ padding: '0 16px', marginTop: 8 }}>
          <button
            className="import-guide-btn"
            onClick={async () => {
              await addTrip(qingdaoTrip)
              alert('칭다오 3박4일 여행이 추가되었습니다!')
            }}
          >
            <Download size={16} />
            <span>칭다오 3박4일 가이드 → 내 여행에 추가</span>
          </button>
        </div>
      )}
      {!loading && !trips.some(t => t.id === dalianTrip.id) && (
        <div style={{ padding: '0 16px', marginTop: 8 }}>
          <button
            className="import-guide-btn"
            onClick={async () => {
              await addTrip(dalianTrip)
              alert('다롄 3박4일 여행이 추가되었습니다!')
            }}
          >
            <Download size={16} />
            <span>다롄 3박4일 가이드 → 내 여행에 추가</span>
          </button>
        </div>
      )}

      {/* 내 여행 섹션 */}
      <div className="section-title" style={{ padding: '0 16px', marginTop: 8 }}>
        <MapPin size={15} />
        <span>내 여행</span>
      </div>

      <div className="home-filters">
        {[
          ['all', '전체'],
          ['upcoming', '예정'],
          ['ongoing', '진행중'],
          ['completed', '완료'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`filter-chip ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="trip-list">
        {loading && <p className="trip-empty">불러오는 중...</p>}

        {!loading && filtered.length === 0 && (
          <div className="trip-empty-card">
            <p>아직 여행이 없어요</p>
            <button onClick={() => navigate('/planner')}>
              + AI로 여행 일정 만들기
            </button>
          </div>
        )}

        {filtered.map(trip => (
          <div key={trip.id} className="trip-card" onClick={() => navigate(`/trip/${trip.id}`)}>
            <div className="trip-emoji">{trip.emoji || '✈️'}</div>
            <div className="trip-info">
              <h3>{trip.title}</h3>
              <div className="trip-meta">
                <span style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {trip.destination}</span>
                <span><Calendar size={13} /> {formatDates(trip)}</span>
              </div>
            </div>
            <div className="trip-right">
              <span className={`trip-badge ${trip.status}`}>
                {STATUS_LABEL[trip.status] || '예정'}
              </span>
              <button className="trip-delete" onClick={(e) => { e.stopPropagation(); removeTrip(trip.id) }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </section>

      <button className="fab" onClick={() => navigate('/planner')}>
        <Plus size={24} />
      </button>
    </div>
  )
}
