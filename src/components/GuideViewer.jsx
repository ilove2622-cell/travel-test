import { ChevronLeft } from 'lucide-react'
import './GuideViewer.css'

export default function GuideViewer({ guide, onClose }) {
  return (
    <div className="guide-viewer">
      <div className="guide-viewer-bar">
        <button className="guide-back" onClick={onClose}>
          <ChevronLeft size={20} />
        </button>
        <span className="guide-viewer-title">{guide.title}</span>
        <span className="guide-viewer-badge" style={{ background: guide.badgeBg, color: guide.badgeColor }}>
          {guide.badge}
        </span>
      </div>
      <iframe
        className="guide-frame"
        src={guide.file}
        title={guide.title}
      />
    </div>
  )
}
