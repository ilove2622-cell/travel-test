import { useState, useEffect, useMemo } from 'react'
import { User, Bell, Heart, Shield, ChevronRight, Flame, Download, Trash2, Plus, X as XIcon } from 'lucide-react'
import useTrips from '../hooks/useTrips'
import { getUserPref, saveUserPref, exportAll, clearAllData } from '../lib/indexeddb'
import SettingsModal from '../components/SettingsModal'
import './My.css'

const MENU_ITEMS = [
  { key: 'dietary', icon: Heart, label: '식이제한 프로필', desc: '고수 제외, 채식 등' },
  { key: 'travelStyle', icon: Flame, label: '여행 스타일', desc: '맛집 탐방, 관광 위주' },
  { key: 'notifications', icon: Bell, label: '알림 설정', desc: '여행 리마인더, 팀 알림' },
  { key: 'privacy', icon: Shield, label: '개인정보 관리', desc: '데이터 백업, 계정 설정' },
]

const DIETARY_TAGS = ['고수', '땅콩', '갑각류', '유제품', '글루텐', '채식', '비건', '할랄', '견과류', '계란']
const STYLE_TAGS = ['맛집 탐방', '관광', '쇼핑', '휴식', '액티비티', '자연', '문화체험', '야경', '카페투어', '사진']

export default function My() {
  const { trips } = useTrips()
  const [activeMenu, setActiveMenu] = useState(null)

  // 동적 통계
  const stats = useMemo(() => {
    const citySet = new Set()
    trips.forEach(t => {
      if (t.destination) citySet.add(t.destination)
    })
    return { trips: trips.length, cities: citySet.size }
  }, [trips])

  return (
    <div className="my">
      <header className="my-header">
        <div className="my-avatar">
          <User size={32} />
        </div>
        <h1>마이페이지</h1>
        <p>여행자 님</p>
      </header>

      <div className="my-stats">
        <div className="my-stat">
          <span className="my-stat-value">{stats.trips}</span>
          <span className="my-stat-label">여행</span>
        </div>
        <div className="my-stat-divider" />
        <div className="my-stat">
          <span className="my-stat-value">{stats.cities}</span>
          <span className="my-stat-label">도시</span>
        </div>
      </div>

      <section className="my-menu">
        {MENU_ITEMS.map(({ key, icon: Icon, label, desc }) => (
          <button key={key} className="menu-item" onClick={() => setActiveMenu(key)}>
            <div className="menu-icon">
              <Icon size={18} />
            </div>
            <div className="menu-text">
              <span className="menu-label">{label}</span>
              <span className="menu-desc">{desc}</span>
            </div>
            <ChevronRight size={18} className="menu-arrow" />
          </button>
        ))}
      </section>

      <div className="my-version">
        TRIPLY v1.0.0
      </div>

      {activeMenu === 'dietary' && (
        <DietaryModal onClose={() => setActiveMenu(null)} />
      )}
      {activeMenu === 'travelStyle' && (
        <TravelStyleModal onClose={() => setActiveMenu(null)} />
      )}
      {activeMenu === 'notifications' && (
        <NotificationsModal onClose={() => setActiveMenu(null)} />
      )}
      {activeMenu === 'privacy' && (
        <PrivacyModal onClose={() => setActiveMenu(null)} />
      )}
    </div>
  )
}

// ── 식이제한 프로필 ──
function DietaryModal({ onClose }) {
  const [selected, setSelected] = useState([])
  const [custom, setCustom] = useState([])
  const [input, setInput] = useState('')

  useEffect(() => {
    getUserPref('dietary').then(pref => {
      if (pref?.tags) setSelected(pref.tags)
      if (pref?.custom) setCustom(pref.custom)
    })
  }, [])

  const save = (tags, customTags) => {
    setSelected(tags)
    setCustom(customTags)
    saveUserPref('dietary', { tags, custom: customTags })
  }

  const toggle = (tag) => {
    const next = selected.includes(tag)
      ? selected.filter(t => t !== tag)
      : [...selected, tag]
    save(next, custom)
  }

  const addCustom = () => {
    const val = input.trim()
    if (!val || custom.includes(val) || DIETARY_TAGS.includes(val)) return
    const next = [...custom, val]
    save(selected, next)
    setInput('')
  }

  const removeCustom = (tag) => {
    const next = custom.filter(t => t !== tag)
    save(selected, next)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCustom() }
  }

  return (
    <SettingsModal title="식이제한 프로필" onClose={onClose}>
      <p className="settings-desc">해당되는 항목을 선택하세요. 여행 일정 추천 시 반영됩니다.</p>
      <div className="tag-grid">
        {DIETARY_TAGS.map(tag => (
          <button
            key={tag}
            className={`tag-chip ${selected.includes(tag) ? 'active' : ''}`}
            onClick={() => toggle(tag)}
          >
            {tag}
          </button>
        ))}
        {custom.map(tag => (
          <button key={tag} className="tag-chip active custom" onClick={() => removeCustom(tag)}>
            {tag}
            <XIcon size={12} style={{ marginLeft: 4 }} />
          </button>
        ))}
      </div>
      <div className="custom-input-wrap">
        <input
          type="text"
          className="custom-input"
          placeholder="직접 입력 (예: 돼지고기)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="custom-add-btn" onClick={addCustom} disabled={!input.trim()}>
          <Plus size={16} />
        </button>
      </div>
    </SettingsModal>
  )
}

// ── 여행 스타일 ──
function TravelStyleModal({ onClose }) {
  const [selected, setSelected] = useState([])

  useEffect(() => {
    getUserPref('travelStyle').then(pref => {
      if (pref?.tags) setSelected(pref.tags)
    })
  }, [])

  const toggle = (tag) => {
    const next = selected.includes(tag)
      ? selected.filter(t => t !== tag)
      : [...selected, tag]
    setSelected(next)
    saveUserPref('travelStyle', { tags: next })
  }

  return (
    <SettingsModal title="여행 스타일" onClose={onClose}>
      <p className="settings-desc">선호하는 여행 스타일을 선택하세요.</p>
      <div className="tag-grid">
        {STYLE_TAGS.map(tag => (
          <button
            key={tag}
            className={`tag-chip ${selected.includes(tag) ? 'active' : ''}`}
            onClick={() => toggle(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </SettingsModal>
  )
}

// ── 알림 설정 ──
function NotificationsModal({ onClose }) {
  const [settings, setSettings] = useState({
    travelReminder: true,
    teamAlert: true,
    scheduleAlert: true,
  })

  useEffect(() => {
    getUserPref('notifications').then(pref => {
      if (pref) {
        const { id, updatedAt, ...rest } = pref
        if (Object.keys(rest).length) setSettings(rest)
      }
    })
  }, [])

  const toggle = (key) => {
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    saveUserPref('notifications', next)
  }

  return (
    <SettingsModal title="알림 설정" onClose={onClose}>
      <div className="toggle-row">
        <span className="toggle-label">여행 리마인더</span>
        <div className={`toggle-switch ${settings.travelReminder ? 'on' : ''}`} onClick={() => toggle('travelReminder')} />
      </div>
      <div className="toggle-row">
        <span className="toggle-label">팀 알림</span>
        <div className={`toggle-switch ${settings.teamAlert ? 'on' : ''}`} onClick={() => toggle('teamAlert')} />
      </div>
      <div className="toggle-row">
        <span className="toggle-label">일정 알림</span>
        <div className={`toggle-switch ${settings.scheduleAlert ? 'on' : ''}`} onClick={() => toggle('scheduleAlert')} />
      </div>
    </SettingsModal>
  )
}

// ── 개인정보 관리 ──
function PrivacyModal({ onClose }) {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleBackup = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `triply-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = async () => {
    await clearAllData()
    setShowConfirm(false)
    onClose()
    window.location.reload()
  }

  return (
    <SettingsModal title="개인정보 관리" onClose={onClose}>
      <button className="privacy-btn backup" onClick={handleBackup}>
        <Download size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
        데이터 백업 (JSON 다운로드)
      </button>
      <button className="privacy-btn danger" onClick={() => setShowConfirm(true)}>
        <Trash2 size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
        모든 데이터 초기화
      </button>

      {showConfirm && (
        <div className="confirm-dialog" onClick={() => setShowConfirm(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <h4>데이터 초기화</h4>
            <p>모든 여행, 발자취, 설정 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setShowConfirm(false)}>취소</button>
              <button className="confirm-ok" onClick={handleReset}>초기화</button>
            </div>
          </div>
        </div>
      )}
    </SettingsModal>
  )
}
