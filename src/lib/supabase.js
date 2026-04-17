import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase 미설정 시 null (오프라인 전용 모드)
export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null

/*
  ── Supabase 테이블 스키마 (SQL) ──

  CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    country_code TEXT,
    start_date DATE,
    end_date DATE,
    people INTEGER DEFAULT 1,
    type TEXT CHECK (type IN ('domestic', 'overseas')),
    styles TEXT[],
    schedule JSONB,
    team_data JSONB DEFAULT '{}',
    status TEXT CHECK (status IN ('upcoming', 'ongoing', 'completed')) DEFAULT 'upcoming',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- 팀 데이터 컬럼 추가 (기존 테이블):
  -- ALTER TABLE trips ADD COLUMN team_data JSONB DEFAULT '{}';

  CREATE TABLE footprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    trip_id UUID REFERENCES trips(id),
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    country_code TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    visit_date DATE,
    spots INTEGER DEFAULT 0,
    photos INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- RLS 정책
  ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
  ALTER TABLE footprints ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users manage own trips"
    ON trips FOR ALL USING (auth.uid() = user_id);

  CREATE POLICY "Users manage own footprints"
    ON footprints FOR ALL USING (auth.uid() = user_id);
*/

// ── 여행 ──

// team_data JSONB ↔ expenses/votes 변환 (photos는 용량 문제로 로컬 전용)
const TEAM_FIELDS = ['expenses', 'votes']

// camelCase ↔ snake_case 매핑
const FIELD_MAP = {
  countryCode: 'country_code',
  startDate: 'start_date',
  endDate: 'end_date',
  guideFile: 'guide_file',
  guideSections: 'guide_sections',
}
const REVERSE_MAP = Object.fromEntries(Object.entries(FIELD_MAP).map(([k, v]) => [v, k]))

function toDbRow(trip) {
  const row = {}
  const teamData = {}
  for (const [key, val] of Object.entries(trip)) {
    if (val === undefined) continue
    // 팀 데이터 → team_data JSONB로 패킹
    if (TEAM_FIELDS.includes(key)) {
      teamData[key] = val
      continue
    }
    // IndexedDB 전용 / 로컬 전용 필드 제거
    if (key === 'synced' || key === 'updatedAt' || key === 'photos') continue
    // camelCase → snake_case
    const dbKey = FIELD_MAP[key] || key
    row[dbKey] = val
  }
  if (Object.keys(teamData).length > 0) {
    row.team_data = teamData
  }
  // 🛡️ UPDATE 시 updated_at을 반드시 현재 시간으로 갱신 (DB DEFAULT는 INSERT에만 적용됨)
  row.updated_at = new Date().toISOString()
  return row
}

function fromDbRow(row) {
  if (!row) return row
  const trip = {}
  for (const [key, val] of Object.entries(row)) {
    if (val === undefined || val === null) continue
    // team_data → 개별 필드로 언패킹
    if (key === 'team_data' && val) {
      for (const f of TEAM_FIELDS) {
        if (val[f]) trip[f] = val[f]
      }
      continue
    }
    // DB 전용 필드 제외 (로컬 저장 불필요)
    if (key === 'created_at' || key === 'user_id') continue
    // updated_at (ISO string) → updatedAt (ms timestamp)
    if (key === 'updated_at') {
      trip.updatedAt = val ? new Date(val).getTime() : Date.now()
      continue
    }
    // snake_case → camelCase
    const appKey = REVERSE_MAP[key] || key
    trip[appKey] = val
  }
  return trip
}

export async function fetchTrips() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data || []).map(fromDbRow)
}

export async function upsertTrip(trip) {
  if (!supabase) return trip
  const row = toDbRow(trip)
  const { data, error } = await supabase
    .from('trips')
    .upsert(row)
    .select()
    .single()
  if (error) {
    const detail = `[upsertTrip] ${error.code || ''} ${error.message} ${error.details || ''} ${error.hint || ''}`.trim()
    console.error(detail, { row })
    const e = new Error(detail)
    e.supabase = error
    throw e
  }
  return fromDbRow(data)
}

export async function removeTrip(id) {
  if (!supabase) return
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw error
}

// ── 발자취 ──

export async function fetchFootprints() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('footprints')
    .select('*')
    .order('visit_date', { ascending: false })
  if (error) throw error
  return data
}

export async function upsertFootprint(fp) {
  if (!supabase) return fp
  const { data, error } = await supabase
    .from('footprints')
    .upsert(fp)
    .select()
    .single()
  if (error) throw error
  return data
}

