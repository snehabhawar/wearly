import { createClient } from '@supabase/supabase-js'
import { localDate } from '../lib/wear-engine'

const CLOSET_ID = '00000000-0000-0000-0000-0000000000c1'
const DAYS = 90

// --- seeded RNG so every run gives the same closet ---
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(2026)
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo)
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000

type Session = { hanger: number; leftAt: number; returnedAt: number | null }

// A rehomed garment's hanger: when its assignment ended and the next garment was hung
type Rehome = { hanger: number; endedAt: number; nextStartedAt: number | null }

type Ctx = { now: number; timeZone: string; rehomes: Rehome[] }

// A calendar day in the closet's timezone
type Day = { start: number; weekday: number; month: number }

// Hanger -> weekly wear propensity (hangers 1-18 are photographed garments)
const FAVORITES = [3, 4, 9, 10]        // heavy rotation
const REGULAR   = [1, 2, 5, 11, 13, 14, 15, 17]
const RARE      = [6, 7, 16]           // seasonal / occasional
const FORGOTTEN = [8, 12, 18, 24]      // zero wears in the window
const BROWSE_ONLY = 18                 // often browsed, never worn
const MYSTERY_LIVE = [19, 20, 21, 22, 23] // light activity only
const DEMO_FRESH = [1, 2]              // keep recent days clear for demo steps

// Hangers whose garments are seasonal: (month ranges, 0-indexed) when they can be worn
const SEASON_OK: Record<number, number[]> = {
  2: [3, 4, 5, 6, 7, 8], 12: [3, 4, 5, 6, 7, 8], 15: [3, 4, 5, 6, 7, 8],
  6: [9, 10, 11, 0, 1], 16: [9, 10, 11, 0, 1], 8: [9, 10, 11, 0, 1],
}

function inSeason(h: number, d: Day) {
  const ok = SEASON_OK[h]
  return !ok || ok.includes(d.month)
}

// Offset of `timeZone` from UTC at an instant, in ms (e.g. -4 h for New York in summer)
function tzOffset(at: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(at)
  const p = Object.fromEntries(parts.map(x => [x.type, Number(x.value)]))
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - at
}

// Midnight in the closet's timezone, `daysAgo` days before now
function dayStart(daysAgo: number, ctx: Ctx): Day {
  const [y, m, d] = localDate(new Date(ctx.now - daysAgo * DAY), ctx.timeZone).split('-').map(Number)
  const utcMidnight = Date.UTC(y, m - 1, d)
  return {
    start: utcMidnight - tzOffset(utcMidnight, ctx.timeZone),
    weekday: new Date(utcMidnight).getUTCDay(),
    month: m - 1,
  }
}

function build(ctx: Ctx): Session[] {
  const out: Session[] = []

  for (let ago = DAYS; ago >= 1; ago--) {
    const day = dayStart(ago, ctx)
    const weekend = [0, 6].includes(day.weekday)
    // Keep the last 2 days free of sessions on demo hangers
    const skipDemo = ago <= 2

    // Morning outfit: 1 top + 1 bottom (+ outer on cool days) on weekdays, looser on weekends
    const wearProb = weekend ? 0.7 : 0.95
    if (rnd() < wearProb) {
      const wear = (h: number) => {
        if (!inSeason(h, day) || FORGOTTEN.includes(h)) return
        if (skipDemo && DEMO_FRESH.includes(h)) return
        const left = day.start + between(6.5, weekend ? 11 : 8.5) * HOUR
        const away = between(4, 11) * HOUR            // real "worn" band: 3h-36h
        out.push({ hanger: h, leftAt: left, returnedAt: left + away })
      }
      const pool = (xs: number[]) => (rnd() < 0.6 ? pick(FAVORITES.filter(f => xs.includes(f)).length ? FAVORITES.filter(f => xs.includes(f)) : xs) : pick(xs))
      const tops = [1, 2, 3, 4, 5, 6, 16].filter(h => inSeason(h, day))
      const bottoms = [9, 10, 11, 12, 17].filter(h => inSeason(h, day))
      wear(pool(tops)); wear(pool(bottoms))
      const cool = [9, 10, 11, 0, 1, 2].includes(day.month)
      if (cool && rnd() < 0.5) wear(pick([7, 13, 14, 8].filter(h => inSeason(h, day))))
    }

    // Browsing noise: lift and put straight back (real browsed band: < 20 min)
    const browses = Math.floor(between(0, 3.2))
    for (let i = 0; i < browses; i++) {
      const h = pick([...FAVORITES, ...REGULAR, ...RARE, ...MYSTERY_LIVE])
      if (skipDemo && DEMO_FRESH.includes(h)) continue
      const left = day.start + between(7, 22) * HOUR
      out.push({ hanger: h, leftAt: left, returnedAt: left + between(0.5, 12) * MIN })
    }

    // Tried-on-and-returned (real band: 20 min - 3 h)
    if (rnd() < 0.15) {
      const h = pick([...REGULAR, ...RARE, 14])
      if (!(skipDemo && DEMO_FRESH.includes(h))) {
        const left = day.start + between(17, 21) * HOUR
        out.push({ hanger: h, leftAt: left, returnedAt: left + between(25, 140) * MIN })
      }
    }

    // Hanger 18: browsed constantly, never worn
    if (rnd() < 0.18) {
      const left = day.start + between(7, 21) * HOUR
      out.push({ hanger: BROWSE_ONLY, leftAt: left, returnedAt: left + between(1, 15) * MIN })
    }
  }

  // Occasional worn_washed: away 2-5 days (36h - 14d band)
  for (let i = 0; i < 4; i++) {
    const day = dayStart(Math.floor(between(10, 80)), ctx)
    const h = pick([14, 13, 11, 17])
    const left = day.start + 9 * HOUR
    out.push({ hanger: h, leftAt: left, returnedAt: left + between(2, 5) * DAY })
  }

  // Rehomed garments (hangers 19-21 in seed.sql): worn a bit, then they leave for good
  // 30 min before their assignment ended. The hanger reads "garment on" again when the
  // next garment is hung, so the events line up with hanger_assignments.
  for (const r of ctx.rehomes) {
    const finalLeave = r.endedAt - 30 * MIN
    for (let k = 0; k < 4; k++) {
      const left = dayStart(Math.floor(between(45, 85)), ctx).start + 8 * HOUR
      const returned = left + between(4, 9) * HOUR
      if (returned < finalLeave) out.push({ hanger: r.hanger, leftAt: left, returnedAt: returned })
    }
    out.push({ hanger: r.hanger, leftAt: finalLeave, returnedAt: r.nextStartedAt })
  }

  // One garment currently away (open absence) so Today/Closet show something live
  out.push({ hanger: 5, leftAt: ctx.now - 2 * HOUR, returnedAt: null })

  return dropOverlaps(out)
}

// A garment can't leave again before it came back: keep the earliest of any
// overlapping sessions on a hanger, with a minute's gap between sessions.
function dropOverlaps(sessions: Session[]): Session[] {
  const freeAt = new Map<number, number>()
  const kept: Session[] = []
  for (const s of [...sessions].sort((a, b) => a.leftAt - b.leftAt)) {
    if (s.leftAt < (freeAt.get(s.hanger) ?? -Infinity)) continue
    kept.push(s)
    freeAt.set(s.hanger, s.returnedAt === null ? Infinity : s.returnedAt + MIN)
  }
  return kept
}

function toEvents(sessions: Session[]) {
  const seq = new Map<number, number>()
  const next = (h: number) => { const n = (seq.get(h) ?? 0) + 1; seq.set(h, n); return n }
  const events: any[] = []
  for (const s of sessions) {
    const hid = (n: number) => `00000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`
    events.push({ hanger_number: s.hanger, hanger_id: hid(s.hanger), on_rail: true, garment_on: false,
      at: s.leftAt })
    if (s.returnedAt) {
      events.push({ hanger_number: s.hanger, hanger_id: hid(s.hanger), on_rail: true, garment_on: true,
        at: s.returnedAt })
    }
  }
  // seq is per hanger, in time order
  events.sort((a, b) => a.at - b.at)
  return events.map(e => ({
    closet_id: CLOSET_ID,
    device_id: '00000000-0000-0000-0000-0000000000d1',
    hanger_id: e.hanger_id,
    on_rail: e.on_rail,
    garment_on: e.garment_on,
    seq: next(e.hanger_number),
    occurred_at: new Date(e.at).toISOString(),
    received_at: new Date(e.at).toISOString(),
  }))
}

// Closet timezone and the rehome times seeded in hanger_assignments
async function loadCtx(db: ReturnType<typeof createClient>): Promise<Ctx> {
  const closet = await db.from('closets').select('timezone').eq('id', CLOSET_ID).single()
  if (closet.error) throw closet.error
  const hangers = await db.from('hangers').select('id, number').eq('closet_id', CLOSET_ID)
  if (hangers.error) throw hangers.error
  const assignments = await db.from('hanger_assignments')
    .select('hanger_id, started_at, ended_at')
    .in('hanger_id', hangers.data.map(h => h.id))
  if (assignments.error) throw assignments.error

  const numberOf = new Map(hangers.data.map(h => [h.id as string, h.number as number]))
  const ms = (t: string) => new Date(t).getTime()
  const rehomes = assignments.data
    .filter(a => a.ended_at !== null)
    .map(ended => {
      const endedAt = ms(ended.ended_at)
      const nextStarts = assignments.data
        .filter(a => a.hanger_id === ended.hanger_id && ms(a.started_at) >= endedAt)
        .map(a => ms(a.started_at))
        .sort((a, b) => a - b)
      return { hanger: numberOf.get(ended.hanger_id)!, endedAt, nextStartedAt: nextStarts[0] ?? null }
    })
  return { now: Date.now(), timeZone: closet.data.timezone, rehomes }
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Idempotent: clear derived + raw data for this closet first
  await db.from('wears').delete().in('garment_id',
    (await db.from('garments').select('id').eq('closet_id', CLOSET_ID)).data!.map(g => g.id))
  await db.from('absences').delete().in('hanger_id',
    (await db.from('hangers').select('id').eq('closet_id', CLOSET_ID)).data!.map(h => h.id))
  await db.from('sensor_events').delete().eq('closet_id', CLOSET_ID)

  const events = toEvents(build(await loadCtx(db)))
  for (let i = 0; i < events.length; i += 500) {
    const { error } = await db.from('sensor_events').insert(events.slice(i, i + 500))
    if (error) throw error
  }
  console.log(`inserted ${events.length} sensor events`)

  await replayWithEngine(db, events)
}

// TODO: wire to lib/wear-engine once it exists.
// Must use the REAL thresholds here, not the closet's demo profile.
async function replayWithEngine(_db: any, _events: any[]) {
  // import { processHangerEvents, REAL_PROFILE } from '../lib/wear-engine'
  // group by hanger, run in occurred_at order, write absences + wears,
  // then mark rehomed garments and set final hanger state (on_rail/garment_on).
  throw new Error('replayWithEngine not wired up yet')
}

main().catch(e => { console.error(e); process.exit(1) })
