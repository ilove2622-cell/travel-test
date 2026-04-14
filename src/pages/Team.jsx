import { useState, useEffect } from 'react'
import { Users, Receipt, Vote, Plus, Trash2, Check, X } from 'lucide-react'
import useTrips from '../hooks/useTrips'
import useTwemoji from '../hooks/useTwemoji'
import { saveTrip, getTrip } from '../lib/indexeddb'
import { syncToCloud } from '../lib/sync'
import './Team.css'

const TABS = [
  { key: 'expense', label: '정산', icon: Receipt },
  { key: 'vote', label: '투표', icon: Vote },
]

const EXP_CATEGORIES = [
  { key: 'food', emoji: '🍽️', label: '식비' },
  { key: 'transport', emoji: '🚕', label: '교통' },
  { key: 'shopping', emoji: '🛍️', label: '쇼핑' },
  { key: 'ticket', emoji: '🎫', label: '입장료' },
  { key: 'hotel', emoji: '🏨', label: '숙소' },
  { key: 'etc', emoji: '💰', label: '기타' },
]

export default function Team() {
  const [tab, setTab] = useState('expense')
  const { trips, loading, reload } = useTrips()
  const emojiRef = useTwemoji()

  const teamTrips = trips.filter(t => t.members && t.members.length > 0)
  const activeTeamTrips = teamTrips.filter(t => t.status !== 'completed')
  const completedTeamTrips = teamTrips.filter(t => t.status === 'completed')
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
  const currentTrip = activeTeamTrips[0] || null
  const activeTripId = currentTrip?.id || null
  const members = currentTrip?.members || []

  // ── 정산 ──
  const [expenses, setExpenses] = useState([])
  const [showExpForm, setShowExpForm] = useState(false)
  const [expForm, setExpForm] = useState({ desc: '', amount: '', payers: [], category: 'food' })

  // ── 투표 ──
  const [votes, setVotes] = useState([])
  const [showVoteForm, setShowVoteForm] = useState(false)
  const [voteForm, setVoteForm] = useState({ question: '', options: ['', ''] })


  // trip 객체에서 팀 데이터 로드 (trips 변경 시마다 갱신)
  useEffect(() => {
    if (!activeTripId) return
    loadData()
  }, [activeTripId, trips])

  // 🛰️ 실시간 동기화 이벤트 수신 → 데이터 리로드
  useEffect(() => {
    const handler = () => {
      if (activeTripId) {
        loadData()
        reload()
      }
    }
    window.addEventListener('triply:data-updated', handler)
    return () => window.removeEventListener('triply:data-updated', handler)
  }, [activeTripId])

  async function loadData() {
    const trip = await getTrip(activeTripId)
    if (!trip) return
    // tombstone(deleted: true) 제외하고 표시
    setExpenses((trip.expenses || []).filter(e => !e.deleted).sort((a, b) => b.updatedAt - a.updatedAt))
    setVotes((trip.votes || []).filter(v => !v.deleted).sort((a, b) => b.updatedAt - a.updatedAt))
  }

  // trip 객체의 배열 필드 업데이트 헬퍼
  async function updateTripField(field, updater) {
    const trip = await getTrip(activeTripId)
    if (!trip) return
    const arr = trip[field] || []
    trip[field] = updater(arr)
    await saveTrip(trip)
    // 🚀 먼저 클라우드 push (실패 시 사라짐 방지)
    try {
      await syncToCloud()
    } catch (err) {
      console.error('[updateTripField] push 실패:', err)
      alert(`⚠️ 클라우드 저장 실패\n${err.message || err}\n\n로컬에는 저장됐지만 다른 팀원에게 반영되지 않았습니다.`)
    }
    await loadData()
    reload()
  }

  // 정산 추가
  async function addExpense() {
    if (!expForm.desc || !expForm.amount || !expForm.payers.length) return
    await updateTripField('expenses', arr => [...arr, {
      id: crypto.randomUUID(),
      desc: expForm.desc,
      amount: Number(expForm.amount),
      payers: expForm.payers,
      category: expForm.category,
      updatedAt: Date.now(),
    }])
    setExpForm({ desc: '', amount: '', payers: [], category: 'food' })
    setShowExpForm(false)
  }

  // 정산 삭제 (tombstone: 삭제 플래그로 표시해서 동기화 시 유지)
  async function removeExpense(id) {
    await updateTripField('expenses', arr => arr.map(e =>
      e.id === id ? { ...e, deleted: true, updatedAt: Date.now() } : e
    ))
  }

  // 투표 추가
  async function addVote() {
    const opts = voteForm.options.filter(o => o.trim())
    if (!voteForm.question || opts.length < 2) return
    await updateTripField('votes', arr => [...arr, {
      id: crypto.randomUUID(),
      question: voteForm.question,
      options: opts.map(o => ({ text: o, voters: [] })),
      updatedAt: Date.now(),
    }])
    setVoteForm({ question: '', options: ['', ''] })
    setShowVoteForm(false)
  }

  // 투표하기
  async function castVote(voteItem, optIdx) {
    await updateTripField('votes', arr => arr.map(v => {
      if (v.id !== voteItem.id) return v
      return {
        ...v,
        options: v.options.map((opt, i) => {
          const voters = opt.voters.filter(v => v !== '나')
          if (i === optIdx) voters.push('나')
          return { ...opt, voters }
        }),
        updatedAt: Date.now(),
      }
    }))
  }

  // 투표 삭제 (tombstone)
  async function removeVote(id) {
    await updateTripField('votes', arr => arr.map(v =>
      v.id === id ? { ...v, deleted: true, updatedAt: Date.now() } : v
    ))
  }

  // 정산 요약
  const expenseSummary = () => {
    if (!expenses.length || !members.length) return null
    const total = expenses.reduce((s, e) => s + e.amount, 0)
    const perPerson = Math.floor(total / members.length)
    const paid = {}
    members.forEach(m => { paid[m.name] = 0 })
    expenses.forEach(e => {
      const payers = e.payers || (e.payer ? [e.payer] : [])
      const share = payers.length ? Math.floor(e.amount / payers.length) : 0
      payers.forEach(p => { if (paid[p] !== undefined) paid[p] += share })
    })
    return { total, perPerson, paid, count: expenses.length }
  }

  const summary = expenseSummary()

  return (
    <div className="team" ref={emojiRef}>
      <header className="team-header">
        <Users size={28} />
        <h1>팀</h1>
      </header>

      {!loading && activeTeamTrips.length > 0 && (
        <div className="team-members-bar">
          {activeTeamTrips.map(trip => (
            <div key={trip.id} className="team-members-row">
              <span className="team-members-trip">{trip.emoji} {trip.title}</span>
              <div className="team-members-avatars">
                {trip.members.map((m, i) => (
                  <div key={i} className="team-avatar-wrap">
                    <span className="team-avatar">{m.emoji}</span>
                    <span className="team-avatar-name">{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="team-tabs">
        {TABS.map(({ key, label }) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 정산 탭 ── */}
      {tab === 'expense' && (
        <div className="team-content">
          {!summary && expenses.length === 0 && (
            <div className="team-empty">
              <p>정산 내역이 없습니다</p>
            </div>
          )}
          {summary && (
            <div className="expense-summary">
              <div className="expense-summary-total">
                <span>총 지출 <span className="expense-count">{summary.count}건</span></span>
                <strong>₩{summary.total.toLocaleString()}</strong>
              </div>
              <div className="expense-summary-per">
                <span>1인당</span>
                <strong>₩{summary.perPerson.toLocaleString()}</strong>
              </div>
              <div className="expense-summary-detail">
                {members.map(m => {
                  const diff = (summary.paid[m.name] || 0) - summary.perPerson
                  return (
                    <div key={m.name} className="expense-member-row">
                      <span>{m.emoji} {m.name}</span>
                      <span>₩{(summary.paid[m.name] || 0).toLocaleString()} 지출</span>
                      <span className={diff >= 0 ? 'expense-plus' : 'expense-minus'}>
                        {diff >= 0 ? `+₩${diff.toLocaleString()}` : `-₩${Math.abs(diff).toLocaleString()}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {expenses.map(exp => {
            const cat = EXP_CATEGORIES.find(c => c.key === exp.category) || EXP_CATEGORIES[5]
            return (
            <div key={exp.id} className="expense-card">
              <span className="expense-card-emoji">{cat.emoji}</span>
              <div className="expense-card-info">
                <div className="expense-card-top">
                  <span className="expense-card-desc">{exp.desc}</span>
                  <span className="expense-card-payer">
                    {(exp.payers || (exp.payer ? [exp.payer] : [])).map(p => {
                      const m = members.find(mm => mm.name === p)
                      return m ? m.emoji : p
                    }).join(' ')} 결제
                  </span>
                </div>
              </div>
              <div className="expense-card-right">
                <span className="expense-card-amount">₩{exp.amount.toLocaleString()}</span>
                <button className="team-delete-btn" onClick={() => removeExpense(exp.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            )
          })}

          {showExpForm ? (
            <div className="team-form">
              <input placeholder="내용 (예: 점심 식사)" value={expForm.desc}
                onChange={e => setExpForm({ ...expForm, desc: e.target.value })} />
              <input placeholder="금액 (원)" type="number" value={expForm.amount}
                onChange={e => setExpForm({ ...expForm, amount: e.target.value })} />
              <div className="team-form-categories">
                {EXP_CATEGORIES.map(c => (
                  <button key={c.key}
                    className={`team-form-cat ${expForm.category === c.key ? 'active' : ''}`}
                    onClick={() => setExpForm({ ...expForm, category: c.key })}
                  >
                    {c.emoji}
                  </button>
                ))}
              </div>
              <div className="team-form-members">
                {members.map(m => (
                  <button key={m.name}
                    className={`team-form-member ${expForm.payers.includes(m.name) ? 'active' : ''}`}
                    onClick={() => {
                      const payers = expForm.payers.includes(m.name)
                        ? expForm.payers.filter(p => p !== m.name)
                        : [...expForm.payers, m.name]
                      setExpForm({ ...expForm, payers })
                    }}
                  >
                    {m.emoji} {m.name}
                  </button>
                ))}
              </div>
              <div className="team-form-actions">
                <button className="team-form-cancel" onClick={() => setShowExpForm(false)}><X size={14} /> 취소</button>
                <button className="team-form-submit" onClick={addExpense}><Check size={14} /> 추가</button>
              </div>
            </div>
          ) : (
            <button className="team-add-btn" onClick={() => setShowExpForm(true)}>
              <Plus size={16} /> 정산 추가
            </button>
          )}
        </div>
      )}

      {/* ── 투표 탭 ── */}
      {tab === 'vote' && (
        <div className="team-content">
          {votes.map(v => (
            <div key={v.id} className="vote-card">
              <div className="vote-question">
                {v.question}
                <button className="team-delete-btn" onClick={() => removeVote(v.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="vote-options">
                {v.options.map((opt, i) => {
                  const totalVotes = v.options.reduce((s, o) => s + o.voters.length, 0)
                  const pct = totalVotes ? Math.round((opt.voters.length / totalVotes) * 100) : 0
                  const voted = opt.voters.includes('나')
                  return (
                    <button key={i} className={`vote-option ${voted ? 'voted' : ''}`}
                      onClick={() => castVote(v, i)}
                    >
                      <div className="vote-option-bar" style={{ width: `${pct}%` }} />
                      <span className="vote-option-text">{opt.text}</span>
                      <span className="vote-option-count">{opt.voters.length}표 ({pct}%)</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {showVoteForm ? (
            <div className="team-form">
              <input placeholder="질문 (예: 저녁 뭐 먹을까?)" value={voteForm.question}
                onChange={e => setVoteForm({ ...voteForm, question: e.target.value })} />
              {voteForm.options.map((opt, i) => (
                <input key={i} placeholder={`선택지 ${i + 1}`} value={opt}
                  onChange={e => {
                    const opts = [...voteForm.options]
                    opts[i] = e.target.value
                    setVoteForm({ ...voteForm, options: opts })
                  }} />
              ))}
              <button className="vote-add-option" onClick={() => setVoteForm({ ...voteForm, options: [...voteForm.options, ''] })}>
                <Plus size={14} /> 선택지 추가
              </button>
              <div className="team-form-actions">
                <button className="team-form-cancel" onClick={() => setShowVoteForm(false)}><X size={14} /> 취소</button>
                <button className="team-form-submit" onClick={addVote}><Check size={14} /> 만들기</button>
              </div>
            </div>
          ) : (
            <button className="team-add-btn" onClick={() => setShowVoteForm(true)}>
              <Plus size={16} /> 투표 만들기
            </button>
          )}
        </div>
      )}

      {!activeTripId && !loading && completedTeamTrips.length === 0 && (
        <div className="team-empty">
          <p>팀 여행을 추가하면 사용할 수 있어요</p>
        </div>
      )}

      {!loading && completedTeamTrips.length > 0 && (
        <div className="team-completed">
          <h3 className="team-completed-title">지난 팀 여행</h3>
          {completedTeamTrips.map(trip => (
            <div key={trip.id} className="team-completed-card">
              <span className="team-completed-emoji">{trip.emoji}</span>
              <div className="team-completed-info">
                <span className="team-completed-name">{trip.title}</span>
                <span className="team-completed-date">{trip.startDate} ~ {trip.endDate}</span>
              </div>
              <div className="team-completed-members">
                {trip.members.map((m, i) => (
                  <span key={i} className="team-completed-avatar">{m.emoji}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
