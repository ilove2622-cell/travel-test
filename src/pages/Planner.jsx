import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, MapPin, CalendarDays, Users, Utensils, Camera, Coffee, ShoppingBag, ChevronRight, ChevronLeft, Loader2, Hotel, Download, Search, Pencil, Check, Plus, CalendarCheck } from 'lucide-react'
import useTwemoji from '../hooks/useTwemoji'
import useTrips from '../hooks/useTrips'
import { generateSchedule } from '../lib/claude'
import { getHotelLink } from '../lib/tripcom'
import { downloadICS } from '../utils/calendar'
import ScheduleCard from '../components/ScheduleCard'
import PlaceSearch from '../components/PlaceSearch'
import './Planner.css'

const STYLES = [
  { id: 'food', label: '맛집', icon: Utensils },
  { id: 'sightseeing', label: '관광', icon: Camera },
  { id: 'relax', label: '휴식', icon: Coffee },
  { id: 'shopping', label: '쇼핑', icon: ShoppingBag },
]

const DEST_COUNTRY = {
  '칭다오': 'CN', '다롄': 'CN', '상하이': 'CN', '베이징': 'CN', '광저우': 'CN', '청두': 'CN', '시안': 'CN',
  '오사카': 'JP', '도쿄': 'JP', '교토': 'JP', '후쿠오카': 'JP',
  '방콕': 'TH', '치앙마이': 'TH', '푸켓': 'TH',
  '하노이': 'VN', '호치민': 'VN', '다낭': 'VN',
  '싱가포르': 'SG', '발리': 'ID', '세부': 'PH',
  '제주': 'KR', '부산': 'KR', '강릉': 'KR', '여수': 'KR', '경주': 'KR', '전주': 'KR', '속초': 'KR',
}

function guessCountryCode(destination, type) {
  if (type === 'domestic') return 'KR'
  for (const [city, code] of Object.entries(DEST_COUNTRY)) {
    if (destination.includes(city)) return code
  }
  return 'DEFAULT'
}

export default function Planner() {
  const [form, setForm] = useState({
    type: '',
    destination: '',
    startDate: '',
    endDate: '',
    people: 1,
    styles: [],
  })
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeDay, setActiveDay] = useState(0)
  const [editing, setEditing] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const navigate = useNavigate()
  const { addTrip } = useTrips()

  const countryCode = guessCountryCode(form.destination, form.type)

  const toggleStyle = (id) => {
    setForm(prev => ({
      ...prev,
      styles: prev.styles.includes(id)
        ? prev.styles.filter(s => s !== id)
        : [...prev.styles, id],
    }))
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await generateSchedule({
        destination: form.destination,
        startDate: form.startDate,
        endDate: form.endDate,
        people: form.people,
        styles: form.styles.length ? form.styles : ['sightseeing', 'food'],
        countryCode,
      })
      setSchedule(result)
      setActiveDay(0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setSchedule(null)
    setActiveDay(0)
    setEditing(false)
  }

  // 일정 수정 함수들
  const updateSchedule = (newDays) => {
    setSchedule(prev => ({ ...prev, days: newDays }))
  }

  const handleDeleteItem = (dayIdx, itemIdx) => {
    const newDays = [...schedule.days]
    newDays[dayIdx] = {
      ...newDays[dayIdx],
      schedule: newDays[dayIdx].schedule.filter((_, i) => i !== itemIdx),
    }
    updateSchedule(newDays)
  }

  const handleMoveItem = (dayIdx, itemIdx, direction) => {
    const newDays = [...schedule.days]
    const items = [...newDays[dayIdx].schedule]
    const target = itemIdx + direction
    if (target < 0 || target >= items.length) return
    ;[items[itemIdx], items[target]] = [items[target], items[itemIdx]]
    // 시간 재배치
    const baseTimes = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30', '21:00']
    items.forEach((item, i) => { item.time = baseTimes[i] || `${20 + i}:00` })
    newDays[dayIdx] = { ...newDays[dayIdx], schedule: items }
    updateSchedule(newDays)
  }

  const handleAddPlace = (place) => {
    const newDays = [...schedule.days]
    const items = newDays[activeDay].schedule
    const lastTime = items.length > 0 ? items[items.length - 1].time : '08:00'
    const [h, m] = lastTime.split(':').map(Number)
    const newH = h + 1 + Math.floor((m + 30) / 60)
    const newM = (m + 30) % 60
    const newTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`

    newDays[activeDay] = {
      ...newDays[activeDay],
      schedule: [...items, { ...place, time: newTime }],
    }
    updateSchedule(newDays)
    setShowSearch(false)
  }

  // 일정 결과 화면
  if (schedule) {
    const days = schedule.days || []
    const currentDay = days[activeDay]
    const hotelLink = getHotelLink(form.destination, countryCode)

    return (
      <div className="planner" ref={useTwemoji()}>
        <header className="result-header">
          <button className="back-btn" onClick={handleBack}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1>{form.destination} 여행 일정</h1>
            <p>{form.startDate} ~ {form.endDate} · {form.people}명</p>
          </div>
          <button
            className={`edit-toggle ${editing ? 'active' : ''}`}
            onClick={() => setEditing(!editing)}
          >
            {editing ? <Check size={16} /> : <Pencil size={16} />}
            {editing ? '완료' : '편집'}
          </button>
        </header>

        <a href={hotelLink} target="_blank" rel="noopener noreferrer" className="hotel-banner">
          <Hotel size={16} />
          <span>Trip.com에서 {form.destination} 숙소 예약하기</span>
          <ChevronRight size={16} />
        </a>

        <div className="day-tabs">
          {days.map((d, i) => (
            <button
              key={i}
              className={`day-tab ${activeDay === i ? 'active' : ''}`}
              onClick={() => setActiveDay(i)}
            >
              Day {d.day}
            </button>
          ))}
        </div>

        {currentDay && (
          <div className="day-schedule">
            <h2 className="day-date">{currentDay.date}</h2>
            {currentDay.schedule.map((item, i) => (
              <ScheduleCard
                key={`${activeDay}-${i}`}
                item={item}
                countryCode={countryCode}
                editable={editing}
                isFirst={i === 0}
                isLast={i === currentDay.schedule.length - 1}
                onMoveUp={() => handleMoveItem(activeDay, i, -1)}
                onMoveDown={() => handleMoveItem(activeDay, i, 1)}
                onDelete={() => handleDeleteItem(activeDay, i)}
              />
            ))}
          </div>
        )}

        <div className="result-actions">
          <button className="add-place-btn" onClick={() => setShowSearch(true)}>
            <Search size={16} />
            장소 검색해서 추가
          </button>
          <button className="calendar-btn" onClick={() => downloadICS({ title: `${form.destination} 여행` }, schedule)}>
            <CalendarCheck size={16} />
            캘린더에 내보내기 (.ics)
          </button>
          <button className="save-btn" onClick={async () => {
            await addTrip({
              title: `${form.destination} 여행`,
              destination: form.destination,
              countryCode,
              startDate: form.startDate,
              endDate: form.endDate,
              people: form.people,
              type: form.type,
              styles: form.styles,
              schedule,
              status: 'upcoming',
              emoji: countryCode === 'CN' ? '🇨🇳' : countryCode === 'JP' ? '🇯🇵' : countryCode === 'KR' ? '🇰🇷' : '✈️',
            })
            navigate('/')
          }}>
            <Download size={16} />
            일정 저장하기
          </button>
        </div>

        {showSearch && (
          <PlaceSearch
            countryCode={countryCode}
            onAdd={handleAddPlace}
            onClose={() => setShowSearch(false)}
          />
        )}
      </div>
    )
  }

  // 입력 폼 화면
  return (
    <div className="planner" ref={useTwemoji()}>
      <header className="planner-header">
        <Sparkles size={20} />
        <h1>AI 여행 플래너</h1>
        <p>AI가 맞춤 일정을 만들어 드려요</p>
      </header>

      <button
        className="demo-preset"
        onClick={() => {
          setForm({ type: 'overseas', destination: '칭다오', startDate: '2025-05-01', endDate: '2025-05-04', people: 2, styles: ['food', 'sightseeing'] })
        }}
        style={{ fontSize: 12, color: '#3B82F6', textDecoration: 'underline', marginBottom: 8, display: 'block' }}
      >
        데모: 칭다오 3박4일 자동 입력
      </button>

      <div className="planner-form">
        <div className="form-section">
          <label className="form-label">여행 유형</label>
          <div className="type-toggle">
            <button
              className={`type-btn ${form.type === 'domestic' ? 'active' : ''}`}
              onClick={() => setForm(p => ({ ...p, type: 'domestic' }))}
            >
              🇰🇷 국내
            </button>
            <button
              className={`type-btn ${form.type === 'overseas' ? 'active' : ''}`}
              onClick={() => setForm(p => ({ ...p, type: 'overseas' }))}
            >
              ✈️ 해외
            </button>
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">
            <MapPin size={15} /> 여행지
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="예: 칭다오, 오사카, 제주도..."
            value={form.destination}
            onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}
          />
        </div>

        <div className="form-row">
          <div className="form-section">
            <label className="form-label">
              <CalendarDays size={15} /> 출발일
            </label>
            <input
              type="date"
              className="form-input"
              value={form.startDate}
              onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
            />
          </div>
          <div className="form-section">
            <label className="form-label">도착일</label>
            <input
              type="date"
              className="form-input"
              value={form.endDate}
              onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
            />
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">
            <Users size={15} /> 인원
          </label>
          <div className="people-control">
            <button onClick={() => setForm(p => ({ ...p, people: Math.max(1, p.people - 1) }))}>-</button>
            <span>{form.people}명</span>
            <button onClick={() => setForm(p => ({ ...p, people: p.people + 1 }))}>+</button>
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">여행 스타일 (복수 선택)</label>
          <div className="style-grid">
            {STYLES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`style-chip ${form.styles.includes(id) ? 'active' : ''}`}
                onClick={() => toggleStyle(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button
          className="generate-btn"
          disabled={!form.destination || !form.startDate || !form.endDate || loading}
          onClick={handleGenerate}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="spin" />
              일정 생성 중...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              AI 일정 생성하기
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
