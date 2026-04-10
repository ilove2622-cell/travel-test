// .ics 캘린더 파일 생성 및 다운로드

/**
 * 여행 일정을 .ics 파일로 변환
 * @param {Object} trip - 여행 정보
 * @param {string} trip.title - 여행 제목
 * @param {Object} schedule - generateSchedule 결과
 */
export function generateICS(trip, schedule) {
  const events = []

  for (const day of schedule.days) {
    for (const item of day.schedule) {
      const [hour, min] = item.time.split(':').map(Number)
      const start = new Date(day.date)
      start.setHours(hour, min, 0)

      const end = new Date(start)
      end.setMinutes(end.getMinutes() + (item.duration || 60))

      events.push(formatEvent({
        summary: item.name,
        description: item.desc || '',
        start,
        end,
        location: item.taxi_addr || item.name_cn || item.name,
      }))
    }
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TRIPLY//AI Travel Planner//KO',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${trip.title}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  return ics
}

function formatEvent({ summary, description, start, end, location }) {
  return [
    'BEGIN:VEVENT',
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(location)}`,
    `UID:${crypto.randomUUID()}@triply.app`,
    'END:VEVENT',
  ].join('\r\n')
}

function formatDate(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeText(text) {
  return (text || '').replace(/[\\;,\n]/g, c => {
    if (c === '\n') return '\\n'
    return '\\' + c
  })
}

/**
 * .ics 파일 다운로드
 */
export function downloadICS(trip, schedule) {
  const ics = generateICS(trip, schedule)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${trip.title || 'TRIPLY'}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
