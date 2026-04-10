import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, CalendarCheck, BookOpen, X } from 'lucide-react'
import useTwemoji from '../hooks/useTwemoji'
import useTrips from '../hooks/useTrips'
import ScheduleCard from '../components/ScheduleCard'
import { downloadICS } from '../utils/calendar'
import dalianTrip from '../data/dalian-trip'
import qingdaoTrip from '../data/qingdao-trip'
import './TripDetail.css'

const GUIDE_MAP = {
  [dalianTrip.id]: { guideFile: dalianTrip.guideFile, guideSections: dalianTrip.guideSections },
  [qingdaoTrip.id]: { guideFile: qingdaoTrip.guideFile, guideSections: qingdaoTrip.guideSections },
}

function getGuideInfo(trip) {
  if (GUIDE_MAP[trip.id]) return GUIDE_MAP[trip.id]
  if (trip.destination === '다롄') return GUIDE_MAP[dalianTrip.id]
  if (trip.destination === '칭다오') return GUIDE_MAP[qingdaoTrip.id]
  return {}
}

export default function TripDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { trips, loading } = useTrips()
  const [activeDay, setActiveDay] = useState(0)
  const [guideUrl, setGuideUrl] = useState(null)
  const emojiRef = useTwemoji()

  const trip = trips.find(t => t.id === id)

  useEffect(() => {
    if (!loading && !trip) navigate('/', { replace: true })
  }, [loading, trip, navigate])

  if (loading || !trip) return <div className="trip-detail-loading">불러오는 중...</div>

  const days = trip.schedule?.days || []
  const currentDay = days[activeDay]
  const guideInfo = getGuideInfo(trip)
  const sections = guideInfo.guideSections || []
  const guideFile = guideInfo.guideFile
  const openGuide = (hash) => {
    setGuideUrl(guideFile + (hash ? '#' + hash : ''))
  }

  if (guideUrl) {
    return (
      <div className="td-guide-viewer">
        <div className="td-guide-bar">
          <button className="td-guide-close" onClick={() => setGuideUrl(null)}>
            <X size={20} />
          </button>
          <span className="td-guide-title">{trip.title} 가이드</span>
        </div>
        <iframe className="td-guide-frame" src={guideUrl} title="guide" />
      </div>
    )
  }

  return (
    <div className="trip-detail" ref={emojiRef}>
      <header className="td-header">
        <button className="td-back" onClick={() => navigate('/')}>
          <ChevronLeft size={20} />
        </button>
        <div className="td-header-info">
          <h1>{trip.emoji} {trip.title}</h1>
          <p>{trip.startDate} ~ {trip.endDate} · {trip.people}명</p>
        </div>
      </header>

      <div className="td-day-tabs">
        {days.map((d, i) => (
          <button
            key={i}
            className={`td-day-tab ${activeDay === i ? 'active' : ''}`}
            onClick={() => setActiveDay(i)}
          >
            Day {d.day}
          </button>
        ))}
      </div>

      {currentDay && (
        <div className="td-schedule">
          <h2 className="td-date">{currentDay.date}</h2>
          {currentDay.schedule.map((item, i) => (
            <div key={`${activeDay}-${i}`}>
              <ScheduleCard
                item={item}
                countryCode={trip.countryCode || 'DEFAULT'}
              />
              {item.travel_next && i < currentDay.schedule.length - 1 && (
                <div className="td-travel-connector">
                  <div className="td-travel-line" />
                  <span className="td-travel-badge">{item.travel_next}</span>
                  <div className="td-travel-line" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {guideFile && sections.length > 0 && (
        <div className="td-guide-section">
          <div className="td-guide-section-header">
            <BookOpen size={15} />
            <span>꿀팁 & 더보기</span>
          </div>
          <div className="td-guide-grid">
            {sections.map(s => (
              <button
                key={s.id}
                className="td-guide-chip"
                onClick={() => openGuide(s.id)}
              >
                <span className="td-guide-chip-emoji">{s.emoji}</span>
                <span className="td-guide-chip-label">{s.label}</span>
              </button>
            ))}
          </div>
          <button className="td-guide-full" onClick={() => openGuide('')}>
            <BookOpen size={14} />
            전체 가이드 보기
          </button>
        </div>
      )}

      <div className="td-actions">
        <button
          className="td-calendar-btn"
          onClick={() => downloadICS(trip, trip.schedule)}
        >
          <CalendarCheck size={16} />
          캘린더에 내보내기 (.ics)
        </button>
      </div>
    </div>
  )
}
