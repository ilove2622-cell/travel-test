import { useState, useRef, useEffect } from 'react'
import { MapPin, ExternalLink, X } from 'lucide-react'
import { getMapLinks } from '../utils/mapOpener'
import useTwemoji from '../hooks/useTwemoji'
import './PlaceLink.css'

/**
 * 장소명 클릭 → 외부 지도 앱 선택 바텀시트
 * @param {string} place - 장소명
 * @param {string} countryCode - 국가 코드
 * @param {string} [nameCn] - 중국어 장소명
 * @param {string} [className] - 추가 CSS 클래스
 */
export default function PlaceLink({ place, countryCode, nameCn, className = '' }) {
  const [open, setOpen] = useState(false)
  const sheetRef = useRef(null)
  const emojiRef = useTwemoji()

  const links = getMapLinks(place, countryCode, nameCn)

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button
        className={`place-link-trigger ${className}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <MapPin size={12} />
        <span>{place}</span>
      </button>

      {open && (
        <div className="place-link-overlay" onClick={() => setOpen(false)}>
          <div
            className="place-link-sheet"
            ref={(el) => { sheetRef.current = el; if (el && window.twemoji) window.twemoji.parse(el, { folder: 'svg', ext: '.svg' }) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-header">
              <div className="sheet-title">
                <MapPin size={16} />
                <span>{place}</span>
              </div>
              <button className="sheet-close" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="sheet-subtitle">지도에서 열기</div>

            <div className="sheet-links">
              {links.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sheet-link-item"
                  onClick={() => setOpen(false)}
                >
                  <span className="sheet-link-icon">{link.icon}</span>
                  <span className="sheet-link-name">{link.name}</span>
                  <ExternalLink size={14} className="sheet-link-arrow" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
