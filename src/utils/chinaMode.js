// 국가별 API 분기 로직

const COUNTRY_CONFIG = {
  CN: {
    name: '중국',
    map: { provider: 'amap', key: import.meta.env.VITE_AMAP_KEY || '' },
    taxi: { app: '디디(滴滴)', scheme: 'didichuanxing://' },
    booking: { url: 'https://www.ctrip.com', label: 'Ctrip (씨트립)' },
    food: { provider: '따종띠엔핑', url: 'https://www.dianping.com' },
    vpnRequired: true,
    wechatPay: true,
    offlineFirst: true, // Supabase(AWS) 차단 대비
  },
  KR: {
    name: '한국',
    map: { provider: 'kakao', key: import.meta.env.VITE_KAKAO_MAP_KEY || '' },
    taxi: { app: '카카오T', scheme: 'kakaot://' },
    booking: { url: 'https://www.yanolja.com', label: '야놀자' },
    food: { provider: '네이버 예약', url: 'https://map.naver.com' },
    vpnRequired: false,
    wechatPay: false,
    offlineFirst: false,
  },
  JP: {
    name: '일본',
    map: { provider: 'google', key: '' },
    taxi: { app: 'GO택시', scheme: '' },
    booking: { url: 'https://trip.com', label: 'Trip.com' },
    food: null,
    vpnRequired: false,
    wechatPay: false,
    offlineFirst: false,
  },
  DEFAULT: {
    name: '해외',
    map: { provider: 'google', key: '' },
    taxi: { app: 'Grab', scheme: 'grab://' },
    booking: { url: 'https://trip.com', label: 'Trip.com' },
    food: null,
    vpnRequired: false,
    wechatPay: false,
    offlineFirst: false,
  },
}

export function getCountryConfig(countryCode) {
  return COUNTRY_CONFIG[countryCode] || COUNTRY_CONFIG.DEFAULT
}

export function isChinaMode(countryCode) {
  return countryCode === 'CN'
}

// Trip.com / Ctrip 자동 분기
export function getBookingUrl(countryCode) {
  const config = getCountryConfig(countryCode)
  return config.booking
}

// Trip.com 어필리에이트 링크 생성
export function getTripcomAffiliateLink(path = '') {
  const affiliateId = import.meta.env.VITE_TRIPCOM_AFFILIATE_ID || ''
  const baseUrl = 'https://trip.com'
  if (!affiliateId) return `${baseUrl}${path}`
  return `${baseUrl}${path}?Allianceid=${affiliateId}`
}

// 택시 주소 복사용 (중국어 주소 포함)
export function getTaxiAddress(place, countryCode) {
  if (countryCode === 'CN' && place.name_cn) {
    return place.name_cn
  }
  return place.name || place.address || ''
}

// 국가 감지 (간단한 타임존 기반)
export function detectCountry() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (tz.startsWith('Asia/Shanghai') || tz.startsWith('Asia/Chongqing')) return 'CN'
  if (tz.startsWith('Asia/Seoul')) return 'KR'
  if (tz.startsWith('Asia/Tokyo')) return 'JP'
  if (tz.startsWith('Asia/Bangkok') || tz.startsWith('Asia/Ho_Chi_Minh')) return 'SEA'
  return 'DEFAULT'
}
