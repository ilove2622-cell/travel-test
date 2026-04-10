// 국가별 외부 지도 앱 링크 생성

const MAP_PROVIDERS = {
  baidu: {
    name: '바이두지도',
    icon: '🗺️',
    getUrl: (query) => `https://api.map.baidu.com/place/search?query=${encodeURIComponent(query)}&region=全国&output=html&src=webapp.triply`,
  },
  amap: {
    name: '고덕지도(Amap)',
    icon: '📍',
    getUrl: (query) => `https://uri.amap.com/search?keyword=${encodeURIComponent(query)}`,
  },
  google: {
    name: '구글지도',
    icon: '🌐',
    getUrl: (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  },
  naver: {
    name: '네이버지도',
    icon: '🟢',
    getUrl: (query) => `https://map.naver.com/v5/search/${encodeURIComponent(query)}`,
  },
}

/**
 * 국가 코드에 따라 사용할 지도 앱 링크 목록을 반환
 * @param {string} placeName - 장소명 (한국어)
 * @param {string} countryCode - 국가 코드 (CN, KR, JP 등)
 * @param {string} [nameCn] - 중국어 장소명 (중국 지도용)
 * @returns {{ name: string, icon: string, url: string }[]}
 */
export function getMapLinks(placeName, countryCode, nameCn) {
  const cnQuery = nameCn || placeName

  switch (countryCode) {
    case 'CN':
      return [
        { ...MAP_PROVIDERS.baidu, url: MAP_PROVIDERS.baidu.getUrl(cnQuery) },
        { ...MAP_PROVIDERS.amap, url: MAP_PROVIDERS.amap.getUrl(cnQuery) },
        { ...MAP_PROVIDERS.google, url: MAP_PROVIDERS.google.getUrl(placeName) },
      ]
    case 'KR':
      return [
        { ...MAP_PROVIDERS.naver, url: MAP_PROVIDERS.naver.getUrl(placeName) },
        { ...MAP_PROVIDERS.google, url: MAP_PROVIDERS.google.getUrl(placeName) },
      ]
    default: // JP, TH, SEA 등
      return [
        { ...MAP_PROVIDERS.google, url: MAP_PROVIDERS.google.getUrl(placeName) },
      ]
  }
}
