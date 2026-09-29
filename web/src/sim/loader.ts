import type { Replay, ReplayColumns, ReplayIndex, ReplayUpdates, Verified } from './types'

const SCHEMA = 1
const DATA_URL = `${import.meta.env.BASE_URL}data/`

type Column = (number | null)[]
type RawReplay = Omit<Replay, 'columns' | 'updates'> & {
  schema: number
  columns: Record<keyof ReplayColumns, Column>
  updates: Record<keyof ReplayUpdates, Column>
}

/** A missing file is a normal state (no export yet); anything else is an error worth surfacing. */
export class MissingDataError extends Error {}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(DATA_URL + path)
  if (res.status === 404) throw new MissingDataError(`${path} not found`)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  const type = res.headers.get('content-type') ?? ''
  // dev servers answer unknown paths with index.html; treat that as missing too
  if (type.includes('text/html')) throw new MissingDataError(`${path} not found`)
  return (await res.json()) as T
}

function checkSchema(obj: { schema: number }, what: string) {
  if (obj.schema !== SCHEMA) throw new Error(`${what}: schema ${obj.schema}, this build reads schema ${SCHEMA}`)
}

const floats = (col: Column) => Float64Array.from(col, (v) => (v === null ? Number.NaN : v))
const bytes = (col: Column) => Uint8Array.from(col, (v) => v ?? 0)

export async function loadIndex(): Promise<ReplayIndex> {
  const index = await fetchJson<ReplayIndex>('index.json')
  checkSchema(index, 'index.json')
  return index
}

export async function loadVerified(): Promise<Verified> {
  const verified = await fetchJson<Verified>('verified.json')
  checkSchema(verified, 'verified.json')
  return verified
}

export async function loadReplay(file: string): Promise<Replay> {
  const raw = await fetchJson<RawReplay>(file)
  checkSchema(raw, file)
  const c = raw.columns
  const columns: ReplayColumns = {
    relT: floats(c.relT),
    x: floats(c.x),
    y: floats(c.y),
    yaw: floats(c.yaw),
    vF: floats(c.vF),
    vL: floats(c.vL),
    posSigma: floats(c.posSigma),
    pXX: floats(c.pXX),
    pYY: floats(c.pYY),
    pXY: floats(c.pXY),
    mode: bytes(c.mode),
    denied: bytes(c.denied),
    truthX: floats(c.truthX),
    truthY: floats(c.truthY),
    truthYaw: floats(c.truthYaw),
    truthSpeed: floats(c.truthSpeed),
    mnSpeed: floats(c.mnSpeed),
    mnSigma: floats(c.mnSigma),
    posError: floats(c.posError),
    blackoutDist: floats(c.blackoutDist),
  }
  for (const [name, col] of Object.entries(columns)) {
    if (col.length !== raw.samples) throw new Error(`${file}: column ${name} has ${col.length} of ${raw.samples} samples`)
  }
  const u = raw.updates
  const updates: ReplayUpdates = {
    relT: floats(u.relT),
    source: bytes(u.source),
    accepted: bytes(u.accepted),
    nis: floats(u.nis),
  }
  return { ...raw, columns, updates }
}
