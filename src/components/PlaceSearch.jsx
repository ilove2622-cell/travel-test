import { useState } from 'react'
import { Search, MapPin, Utensils, Camera, Coffee, ShoppingBag, Plus, X } from 'lucide-react'
import './PlaceSearch.css'

// 카테고리별 추천 장소 (데모용, 추후 API 연동)
const PLACE_DB = {
  CN: {
    food: [
      { name: '왕지에훠궈(王姐火锅)', name_cn: '王姐火锅', desc: '현지인 추천 훠궈', duration: 90 },
      { name: '피지우지에(啤酒街)', name_cn: '啤酒街', desc: '칭다오 맥주거리 해산물', duration: 90 },
      { name: '따중띠엔핑 맛집', name_cn: '大众点评美食', desc: '따종띠엔핑 평점 4.5+', duration: 60 },
      { name: '지아오즈(饺子) 전문점', name_cn: '饺子馆', desc: '산둥식 만두', duration: 60 },
    ],
    sightseeing: [
      { name: '잔차오(栈桥)', name_cn: '栈桥', desc: '칭다오 상징 해변 다리', duration: 60 },
      { name: '바다린(八大关)', name_cn: '八大关', desc: '유럽풍 건축물 거리', duration: 120 },
      { name: '신호산공원(信号山)', name_cn: '信号山公园', desc: '칭다오 시내 전망', duration: 90 },
      { name: '칭다오 맥주 박물관', name_cn: '青岛啤酒博物馆', desc: '칭다오 맥주 역사', duration: 90 },
    ],
    shopping: [
      { name: '타이둥 보행가(台东步行街)', name_cn: '台东步行街', desc: '현지 쇼핑 거리', duration: 120 },
      { name: '지모루 시장(即墨路市场)', name_cn: '即墨路小商品市场', desc: '기념품 시장', duration: 90 },
    ],
    relax: [
      { name: '제1해수욕장', name_cn: '第一海水浴场', desc: '칭다오 대표 해변', duration: 120 },
      { name: '올림픽 요트센터', name_cn: '奥帆中心', desc: '해변 산책로', duration: 60 },
    ],
  },
  KR: {
    food: [
      { name: '흑돼지 거리', desc: '제주 대표 맛집', duration: 90 },
      { name: '해녀의 집', desc: '신선한 해산물', duration: 60 },
      { name: '오메기떡 카페', desc: '제주 전통 간식', duration: 45 },
    ],
    sightseeing: [
      { name: '성산일출봉', desc: '유네스코 세계유산', duration: 120 },
      { name: '만장굴', desc: '용암동굴 탐험', duration: 90 },
      { name: '우도', desc: '자전거 섬 투어', duration: 180 },
    ],
  },
  DEFAULT: {
    food: [
      { name: '현지 추천 맛집', desc: '인기 레스토랑', duration: 90 },
    ],
    sightseeing: [
      { name: '대표 관광지', desc: '필수 방문 명소', duration: 120 },
    ],
  },
}

const CATEGORY_ICONS = {
  food: { icon: Utensils, label: '맛집', color: '#EF4444' },
  sightseeing: { icon: Camera, label: '관광', color: '#3B82F6' },
  shopping: { icon: ShoppingBag, label: '쇼핑', color: '#8B5CF6' },
  relax: { icon: Coffee, label: '휴식', color: '#10B981' },
}

export default function PlaceSearch({ countryCode, onAdd, onClose }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('food')

  const db = PLACE_DB[countryCode] || PLACE_DB.DEFAULT
  const places = db[category] || []

  const filtered = query
    ? places.filter(p => p.name.includes(query) || (p.name_cn && p.name_cn.includes(query)) || p.desc.includes(query))
    : places

  const handleAdd = (place) => {
    onAdd({
      ...place,
      category,
      time: '',
    })
  }

  // 커스텀 장소 추가
  const handleCustomAdd = () => {
    if (!query.trim()) return
    onAdd({
      name: query.trim(),
      desc: '직접 추가한 장소',
      category,
      duration: 60,
      time: '',
    })
    setQuery('')
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-sheet" onClick={e => e.stopPropagation()}>
        <div className="search-header">
          <h3>장소 검색</h3>
          <button className="search-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="search-input-wrap">
          <Search size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="맛집, 관광지 이름으로 검색..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="search-categories">
          {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, label }]) => (
            <button
              key={key}
              className={`search-cat ${category === key ? 'active' : ''}`}
              onClick={() => setCategory(key)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="search-results">
          {filtered.map((place, i) => {
            const catConfig = CATEGORY_ICONS[category]
            return (
              <div key={i} className="search-result-item">
                <div className="search-result-icon" style={{ color: catConfig.color }}>
                  <MapPin size={16} />
                </div>
                <div className="search-result-info">
                  <span className="search-result-name">{place.name}</span>
                  {place.name_cn && <span className="search-result-cn">{place.name_cn}</span>}
                  <span className="search-result-desc">{place.desc} · {place.duration}분</span>
                </div>
                <button className="search-add-btn" onClick={() => handleAdd(place)}>
                  <Plus size={16} />
                </button>
              </div>
            )
          })}

          {query.trim() && (
            <div className="search-result-item search-custom">
              <div className="search-result-icon" style={{ color: '#6B7280' }}>
                <Plus size={16} />
              </div>
              <div className="search-result-info">
                <span className="search-result-name">"{query}" 직접 추가</span>
                <span className="search-result-desc">커스텀 장소로 일정에 추가</span>
              </div>
              <button className="search-add-btn" onClick={handleCustomAdd}>
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
