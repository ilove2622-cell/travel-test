import { X } from 'lucide-react'
import './SettingsModal.css'

export default function SettingsModal({ title, onClose, children }) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h3>{title}</h3>
          <button className="settings-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="settings-body">
          {children}
        </div>
      </div>
    </div>
  )
}
