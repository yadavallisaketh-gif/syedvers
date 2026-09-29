/*
 * Replay data model. Mirrors scripts/export_web_data.py (schema 1): the JSON is columnar,
 * `null` for missing values; the loader turns every column into a typed array with NaN.
 *
 * Coordinates: local metres, East (x) / North (y), relative to the car's true position at
 * GNSS loss. yaw is the EKF convention: radians, counter-clockwise from East.
 * relT: seconds relative to GNSS loss (negative before the blackout).
 */

export const MODE_INIT = 0
export const MODE_GNSS = 1
export const MODE_DR = 2
export type ModeCode = typeof MODE_INIT | typeof MODE_GNSS | typeof MODE_DR

export type DataSource = 'engine' | 'synthetic'

export interface ReplayColumns {
  relT: Float64Array
  x: Float64Array
  y: Float64Array
  yaw: Float64Array
  vF: Float64Array
  vL: Float64Array
  posSigma: Float64Array
  pXX: Float64Array
  pYY: Float64Array
  pXY: Float64Array
  mode: Uint8Array
  denied: Uint8Array
  truthX: Float64Array
  truthY: Float64Array
  truthYaw: Float64Array
  truthSpeed: Float64Array
  mnSpeed: Float64Array
  mnSigma: Float64Array
  posError: Float64Array
  blackoutDist: Float64Array
}

/** Every EKF measurement update in the replay span. `source` indexes `Replay.sources`. */
export interface ReplayUpdates {
  relT: Float64Array
  source: Uint8Array
  accepted: Uint8Array
  nis: Float64Array
}

export interface Anomaly {
  relT: number
  kind: string
  magnitude: number | null
  mode: string
}

export interface ReplayMetrics {
  driftPct: number | null
  endpointErrorM: number | null
  distanceM: number | null
  ateM: number | null
  speedRmseMps: number | null
  headingMaeDeg: number | null
  reacqMaxStepM: number | null
}

export interface ReplayProfile {
  config: string
  variant: string
  leverArmX: number
  nhcSigma: number
  gnssTimeoutS: number
}

export interface Replay {
  source: DataSource
  id: string
  drive: string
  tStart: number
  tEnd: number
  durationS: number
  rateHz: number
  samples: number
  profile: ReplayProfile
  metrics: ReplayMetrics
  verifiedDriftPct: number | null
  gnssUpdatesInBlackout: number
  mountYawDeg: number | null
  modes: string[]
  sources: string[]
  columns: ReplayColumns
  updates: ReplayUpdates
  anomalies: Anomaly[]
}

export interface ReplayIndexEntry {
  id: string
  drive: string
  tStart: number
  durationS: number
  driftPct: number | null
  file: string
  median: boolean
}

export interface ReplayIndex {
  schema: number
  source: DataSource
  defaultId: string
  replays: ReplayIndexEntry[]
}

export interface VerifiedSummary {
  durationS: number
  windows: number
  meanDistanceM: number | null
  medianDriftPct: number | null
  meanDriftPct: number | null
  rawInsMedianDriftPct: number | null
}

export interface VerifiedWindow {
  drive: string
  tStart: number
  driftPct: number | null
  endpointErrorM: number | null
  distanceM: number | null
  ateM: number | null
  speedRmseMps: number | null
  headingMaeDeg: number | null
  reacqMaxStepM: number | null
  anomShock: number
  anomTransient: number
  anomSlip: number
}

export interface Verified {
  schema: number
  source: string
  variant: string
  profile: string
  testDrives: string[]
  summary: VerifiedSummary[]
  windows60s: VerifiedWindow[]
}
