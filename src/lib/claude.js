// Claude API 일정 생성 모듈

const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY || ''
const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `당신은 아시아 여행 전문 플래너입니다. 직접 다녀온 것처럼 구체적이고 실용적인 일정을 만듭니다.
사용자의 여행 정보를 받아 상세한 일정을 JSON 형식으로만 출력합니다.
preamble이나 설명 없이 순수 JSON만 출력하세요.

출력 JSON 구조:
{
  "days": [
    {
      "day": 1,
      "date": "2025-05-01",
      "schedule": [
        {
          "time": "09:00",
          "name": "장소 한국어명",
          "name_cn": "中文名称 (중국 여행시)",
          "name_local": "現地語名 (일본 등 해당 국가 언어)",
          "desc": "구체적 설명 (1인 예상비용, 추천메뉴, 꿀팁 포함)",
          "duration": 60,
          "addr": "도로명 주소 (국내여행 필수, 해외는 생략)",
          "taxi_addr": "택시앱용 주소 (해외여행시)",
          "travel_next": "다음 장소까지 이동수단 + 시간 (예: 택시 15분 약 30위안)",
          "category": "food|sightseeing|shopping|relax|transport|hotel"
        }
      ]
    }
  ]
}

=== 핵심 규칙 ===

1. 일정 밀도: 하루 7~9개 활동 (아침 7~8시 ~ 밤 9~10시). 절대 6개 미만 금지.
   - 아침식사, 오전 관광 2~3곳, 점심, 오후 관광/쇼핑 2~3곳, 저녁, 야경/야시장

2. 구체적 디테일 필수:
   - name: 실제 존재하는 장소명 (체인점이면 지점명까지)
   - desc에 반드시 포함: 1인 예상비용(현지통화), 추천메뉴/볼거리, 영업시간, 예약필요 여부
   - desc에 현지 꿀팁 추가: 오픈런 필요, 줄서기 예상시간, 주문 팁, 할인 팁 등
   - duration: 실제 소요시간 (식사 60~90분, 관광지 90~120분, 카페 45~60분)

3. travel_next 필수 (각 날의 마지막 항목 제외):
   - 이동수단 + 소요시간 + 예상비용 (예: "택시 15분 약 25위안", "도보 5분", "지하철 2호선 3정거장 20분")

4. 첫날/마지막날 패턴:
   - 해외여행: 첫날 공항도착(transport) → 호텔체크인(hotel) → 호텔 근처 일정 / 마지막날 호텔체크아웃(hotel) → 공항이동(transport)
   - 국내여행(한국): 공항 없음! 자가용/KTX/버스로 이동. 첫날 출발지→목적지 이동(transport) → 바로 일정 시작 / 마지막날 일정 후 귀가(transport)
   - 당일치기(0박1일): 호텔/숙소 없음! hotel 카테고리 사용 금지. 아침 출발(transport) → 종일 관광/맛집 → 저녁 귀가(transport)

5. 동선 최적화: 같은 지역/구역 장소끼리 묶어서 배치. 왔다갔다 금지.

6. category: food/sightseeing/shopping/relax/transport/hotel 중 하나
   - hotel: 체크인, 체크아웃에 사용

7. 모든 장소는 실제 존재하는 곳이어야 합니다. 가상의 장소를 만들지 마세요.

8. name 작성 금지 패턴 (절대 사용 금지):
   - "추천맛집리스트", "현지 맛집", "대표 관광지", "쇼핑거리" 같은 포괄적/추상적 이름 금지
   - 반드시 실제 상호명을 사용 (예: "춘천 명동닭갈비", "교동짬뽕 중앙로점", "남이섬")
   - 식당은 반드시 실제 상호명 + desc에 대표메뉴와 1인 가격 명시

9. addr(주소) 필드:
   - 국내여행(한국): 모든 장소에 도로명 주소 필수! 동일 상호가 전국에 많으므로 주소로 구분 필요. 네비게이션 검색에 직접 활용됨.
   - 해외여행: addr 생략. 대신 taxi_addr 사용.`

// 국가별 추가 프롬프트
const COUNTRY_PROMPTS = {
  CN: `중국 여행 특화 규칙:
- name_cn: 반드시 중국어 간체로 정확한 장소명 기입
- taxi_addr: DiDi(滴滴)에 붙여넣을 수 있는 정확한 중국어 주소
- desc에 포함: 위챗페이/알리페이 결제 팁, VPN 필요 여부
- 택시비: DiDi 기준 예상 비용 (위안)
- 가격은 인민폐(CNY/元)로 표기
- 중국 현지 앱 팁: 다중핑(大众点评), 가오더지도(高德地图) 활용법`,

  JP: `일본 여행 특화 규칙:
- name_local: 일본어(한자/가나)로 정확한 장소명
- 교통패스 팁: 스이카/파스모, JR패스, 1일권 등 해당시 안내
- 가격은 엔화(JPY/円)로 표기
- 편의점(콘비니) 활용 팁, IC카드 충전 팁
- taxi_addr: 일본어 주소`,

  KR: `국내 여행 특화 규칙:
- 국내여행은 공항 이용 안 함! 자가용 또는 KTX/고속버스로 이동
- 첫날: 출발지에서 자가용/KTX로 목적지 이동(transport) → 숙소 체크인 → 바로 관광 시작
- 마지막날: 관광/맛집 후 자가용/KTX로 귀가(transport)
- travel_next: "자가용 15분", "도보 10분" 등 자가용/도보/대중교통 기준
- 가격은 원화(KRW/원)로 표기
- 네이버지도/카카오맵 기준 이동시간
- 맛집은 실제 상호명 필수. 네이버 평점/블로그 리뷰 인기 맛집 위주 추천
- 주차 팁: 관광지별 주차장 유무, 주차비 안내
- addr 필드 필수! 모든 장소에 정확한 도로명 주소 기입 (예: "강원도 춘천시 금강로 62"). 같은 상호명이 전국에 많으므로 주소로 정확히 구분해야 함`,

  TH: `태국 여행 특화 규칙:
- 그랩(Grab) 택시 예상비용 (바트)
- 가격은 바트(THB/฿)로 표기
- 방콕 BTS/MRT 노선 안내
- 현지 팁: 흥정 팁, 사원 복장규정 등`,

  VN: `베트남 여행 특화 규칙:
- 그랩(Grab) 택시 예상비용 (동)
- 가격은 동(VND)으로 표기
- 현지 팁: 흥정, 오토바이 주의, 길 건너기 팁`,
}

// 동남아 국가코드 목록
const SOUTHEAST_ASIA = ['TH', 'VN', 'PH', 'SG', 'MY', 'ID', 'MM', 'KH', 'LA']

/**
 * Claude API로 여행 일정 생성
 * @param {Object} params
 * @param {string} params.destination - 여행지
 * @param {string} params.startDate - 출발일 YYYY-MM-DD
 * @param {string} params.endDate - 귀국일 YYYY-MM-DD
 * @param {number} params.people - 인원
 * @param {string[]} params.styles - 여행 스타일 [food, sightseeing, relax, shopping]
 * @param {string} [params.dietary] - 식이제한
 * @param {string} [params.countryCode] - 국가코드
 */
export async function generateSchedule(params) {
  const { destination, startDate, endDate, people, styles, dietary, countryCode } = params

  // 국가별 추가 프롬프트 결정
  let countryPrompt = COUNTRY_PROMPTS[countryCode] || ''
  if (!countryPrompt && SOUTHEAST_ASIA.includes(countryCode)) {
    countryPrompt = `동남아 여행 특화 규칙:
- 그랩(Grab) 택시 예상비용 (현지통화)
- 현지통화로 가격 표기
- 현지 팁: 흥정, 주의사항 포함`
  }

  const fullSystemPrompt = countryPrompt
    ? `${SYSTEM_PROMPT}\n\n${countryPrompt}`
    : SYSTEM_PROMPT

  const start = new Date(startDate)
  const end = new Date(endDate)
  const nights = Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))

  const isKR = countryCode === 'KR'
  const isDayTrip = nights === 0

  const userPrompt = `여행 일정을 만들어주세요.

여행지: ${destination}
날짜: ${startDate} ~ ${endDate} (${isDayTrip ? '당일치기' : `${nights}박${nights + 1}일`})
인원: ${people}명
선호 스타일: ${styles.join(', ')}
${dietary ? `식이제한: ${dietary}` : ''}
${isKR ? `이동수단: 자가용 (공항 이용 없음. 출발지에서 자가용으로 ${destination}까지 이동)` : ''}
${isDayTrip ? '당일치기 여행입니다. 호텔/숙소 없음. hotel 카테고리 사용 금지. 아침 출발 → 종일 관광/맛집 → 저녁 귀가로 구성하세요.' : ''}

중요 지시사항:
- 하루에 최소 7개 이상의 활동을 포함해주세요. 아침식사부터 야경/야시장까지 빈 시간 없이 알차게 구성하세요.
- 모든 식당/카페는 반드시 실제 상호명을 사용하세요. "추천맛집", "현지 맛집", "맛집리스트" 같은 포괄적 이름은 절대 금지입니다.
- desc에는 1인 예상비용, 대표메뉴, 영업시간, 현지 꿀팁을 반드시 포함하세요.
- travel_next 필드로 다음 장소까지의 이동수단과 시간을 명시하세요.${isKR ? `\n- 국내여행입니다. 자가용 기준으로 이동시간과 주차 정보를 안내하세요.\n- 모든 장소에 addr 필드로 도로명 주소를 반드시 기입하세요. 같은 상호명이 전국에 많으므로 주소가 없으면 네비게이션에서 찾을 수 없습니다.` : ''}`

  // API 키 없으면 데모 데이터 반환
  if (!CLAUDE_API_KEY) {
    return getDemoSchedule(destination, startDate, endDate, countryCode)
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: fullSystemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API 오류: ${response.status} ${err}`)
  }

  const data = await response.json()
  const text = data.content[0].text

  // JSON 파싱
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('일정 JSON 파싱 실패')

  return JSON.parse(jsonMatch[0])
}

// API 키 없을 때 데모 데이터
function getDemoSchedule(destination, startDate, endDate, countryCode) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const dayCount = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1)

  const isCN = countryCode === 'CN'

  const days = Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]

    return {
      day: i + 1,
      date: dateStr,
      schedule: [
        {
          time: '09:00',
          name: i === 0 ? `${destination} 도착 / 호텔 체크인` : `${destination} 아침 산책`,
          name_cn: isCN ? `${destination}到达` : undefined,
          desc: i === 0 ? '공항에서 호텔로 이동 후 짐 정리' : '호텔 주변 아침 산책',
          duration: 60,
          taxi_addr: isCN ? `${destination}机场` : undefined,
          category: 'transport',
        },
        {
          time: '10:30',
          name: `${destination} 대표 관광지`,
          name_cn: isCN ? `${destination}景点` : undefined,
          desc: '현지 대표 명소 둘러보기',
          duration: 120,
          category: 'sightseeing',
        },
        {
          time: '12:30',
          name: `${destination} 현지 맛집`,
          name_cn: isCN ? `${destination}美食` : undefined,
          desc: '현지 대표 음식 체험',
          duration: 90,
          category: 'food',
        },
        {
          time: '14:30',
          name: `${destination} 시장/쇼핑거리`,
          name_cn: isCN ? `${destination}商场` : undefined,
          desc: '기념품 쇼핑 및 현지 시장 구경',
          duration: 120,
          category: 'shopping',
        },
        {
          time: '17:00',
          name: `${destination} 카페/휴식`,
          name_cn: isCN ? `${destination}咖啡厅` : undefined,
          desc: '현지 카페에서 여유로운 오후',
          duration: 60,
          category: 'relax',
        },
        {
          time: '18:30',
          name: `${destination} 저녁 식사`,
          name_cn: isCN ? `${destination}晚餐` : undefined,
          desc: '현지 저녁 맛집 방문',
          duration: 90,
          category: 'food',
        },
      ],
    }
  })

  return { days }
}
