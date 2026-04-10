// Trip.com 어필리에이트 링크 생성

const AFFILIATE_ID = import.meta.env.VITE_TRIPCOM_AFFILIATE_ID || ''

export function getHotelLink(destination, countryCode) {
  const base = countryCode === 'CN'
    ? 'https://www.ctrip.com/hotels'
    : 'https://www.trip.com/hotels'

  const url = `${base}/?keyword=${encodeURIComponent(destination)}`
  return AFFILIATE_ID ? `${url}&Allianceid=${AFFILIATE_ID}` : url
}

export function getActivityLink(destination, countryCode) {
  const base = countryCode === 'CN'
    ? 'https://www.ctrip.com/things-to-do'
    : 'https://www.trip.com/things-to-do'

  const url = `${base}/?keyword=${encodeURIComponent(destination)}`
  return AFFILIATE_ID ? `${url}&Allianceid=${AFFILIATE_ID}` : url
}
