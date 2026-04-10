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

// team_data JSONB ↔ expenses/votes/photos 변환
const TEAM_FIELDS = ['expenses', 'votes', 'photos']

function packTeamData(trip) {
  const packed = { ...trip }
  const teamData = {}
  for (const f of TEAM_FIELDS) {
    if (packed[f]) {
      teamData[f] = packed[f]
      delete packed[f]
    }
  }
  if (Object.keys(teamData).length > 0) {
    packed.team_data = teamData
  }
  // IndexedDB 전용 필드 제거
  delete packed.synced
  delete packed.updatedAt
  return packed
}

function unpackTeamData(row) {
  if (!row) return row
  const unpacked = { ...row }
  if (unpacked.team_data) {
    for (const f of TEAM_FIELDS) {
      if (unpacked.team_data[f]) {
        unpacked[f] = unpacked.team_data[f]
      }
    }
    delete unpacked.team_data
  }
  return unpacked
}

export async function fetchTrips() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data || []).map(unpackTeamData)
}

export async function upsertTrip(trip) {
  if (!supabase) return trip
  const packed = packTeamData(trip)
  const { data, error } = await supabase
    .from('trips')
    .upsert(packed)
    .select()
    .single()
  if (error) throw error
  return unpackTeamData(data)
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

