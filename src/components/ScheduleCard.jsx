import { useState } from 'react'
import { Clock, Utensils, Camera, ShoppingBag, Coffee, Bus, Hotel, ChevronUp, ChevronDown, Trash2, Copy, Check } from 'lucide-react'
import PlaceLink from './PlaceLink'
import './ScheduleCard.css'

const CATEGORY_CONFIG = {
  food: { icon: Utensils, color: '#EF4444', bg: '#FEF2F2', label: '맛집' },
  sightseeing: { icon: Camera, color: '#3B82F6', bg: '#EFF6FF', label: '관광' },
  shopping: { icon: ShoppingBag, color: '#8B5CF6', bg: '#F5F3FF', label: '쇼핑' },
  relax: { icon: Coffee, color: '#10B981', bg: '#ECFDF5', label: '휴식' },
  transport: { icon: Bus, color: '#6B7280', bg: '#F9FAFB', label: '이동' },
  hotel: { icon: Hotel, color: '#F59E0B', bg: '#FFFBEB', label: '숙소' },
}

export default function ScheduleCard({ item, countryCode, editable, onMoveUp, onMoveDown, onDelete, isFirst, isLast }) {
  const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.sightseeing
  const Icon = config.icon
  const [copied, setCopied] = useState(false)

  const handleCopyAddr = async () => {
    try {
      await navigator.clipboard.writeText(item.taxi_addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* fallback */ }
  }

  return (
    <div className="schedule-card">
      <div className="schedule-time">
        <Clock size={12} />
        <span>{item.time}</span>
      </div>
      <div className="schedule-body">
        <div className="schedule-icon" style={{ background: config.bg, color: config.color }}>
          <Icon size={16} />
        </div>
        <div className="schedule-content">
          <div className="schedule-name">
            <PlaceLink
              place={item.name}
              countryCode={countryCode}
              nameCn={item.taxi_addr || item.name_cn}
            />
          </div>
          {item.desc && <p className="schedule-desc">{item.desc}</p>}
          {item.taxi_addr && (
            <button className="taxi-addr-btn" onClick={handleCopyAddr}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span className="taxi-addr-text">{item.taxi_addr}</span>
              <span className="taxi-addr-label">{copied ? '복사됨!' : '복사'}</span>
            </button>
          )}
          <div className="schedule-tags">
            <span className="schedule-tag" style={{ background: config.bg, color: config.color }}>
              {config.label}
            </span>
            {item.duration && (
              <span className="schedule-duration">{item.duration}분</span>
            )}
          </div>
        </div>

        {editable && (
          <div className="schedule-actions">
            <button
              className="schedule-action-btn"
              onClick={onMoveUp}
              disabled={isFirst}
            >
              <ChevronUp size={14} />
            </button>
            <button
              className="schedule-action-btn"
              onClick={onMoveDown}
              disabled={isLast}
            >
              <ChevronDown size={14} />
            </button>
            <button
              className="schedule-action-btn delete"
              onClick={onDelete}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
