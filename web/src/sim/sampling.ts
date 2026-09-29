import type { Replay } from './types'

/** Index of the last sample at or before `t` (clamped to the replay). */
export function sampleIndex(relT: Float64Array, t: number): number {
  const n = relT.length
  if (n === 0 || t <= relT[0]) return 0
  if (t >= relT[n - 1]) return n - 1
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (relT[mid] <= t) lo = mid
    else hi = mid
  }
  return lo
}

/** Count of sorted values <= t (binary search), for event streams. */
export function countUpTo(sorted: ArrayLike<number>, t: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

export interface Cursor {
  i: number // sample at or before t
  j: number // next sample (== i at the end)
  f: number // 0..1 between them
}

export function cursorAt(relT: Float64Array, t: number): Cursor {
  const i = sampleIndex(relT, t)
  const j = Math.min(i + 1, relT.length - 1)
  const span = relT[j] - relT[i]
  const f = span > 0 ? Math.min(Math.max((t - relT[i]) / span, 0), 1) : 0
  return { i, j, f }
}

/** Linear interpolation that tolerates NaN at either end (holds the finite side). */
export function lerpCol(col: Float64Array, c: Cursor): number {
  const a = col[c.i]
  const b = col[c.j]
  if (!Number.isFinite(a)) return b
  if (!Number.isFinite(b)) return a
  return a + (b - a) * c.f
}

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

export function lerpAngle(col: Float64Array, c: Cursor): number {
  const a = col[c.i]
  const b = col[c.j]
  if (!Number.isFinite(a)) return b
  if (!Number.isFinite(b)) return a
  return a + wrapAngle(b - a) * c.f
}

export interface Pose {
  x: number
  y: number
  yaw: number
}

export function estimatePose(r: Replay, c: Cursor): Pose {
  const k = r.columns
  return { x: lerpCol(k.x, c), y: lerpCol(k.y, c), yaw: lerpAngle(k.yaw, c) }
}

export function truthPose(r: Replay, c: Cursor): Pose {
  const k = r.columns
  return { x: lerpCol(k.truthX, c), y: lerpCol(k.truthY, c), yaw: lerpAngle(k.truthYaw, c) }
}

export interface Ellipse {
  major: number // 1-sigma semi-axis, m
  minor: number
  angle: number // major axis direction, rad CCW from East
}

/** 1-sigma ellipse of the 2x2 position covariance [[xx, xy], [xy, yy]] (m^2). */
export function covarianceEllipse(xx: number, yy: number, xy: number): Ellipse {
  const mean = (xx + yy) / 2
  const d = Math.sqrt(((xx - yy) / 2) ** 2 + xy * xy)
  return {
    major: Math.sqrt(Math.max(mean + d, 0)),
    minor: Math.sqrt(Math.max(mean - d, 0)),
    angle: 0.5 * Math.atan2(2 * xy, xx - yy),
  }
}

/** ENU yaw (CCW from East) -> compass bearing in degrees (clockwise from North). */
export function bearingDeg(yaw: number): number {
  const deg = 90 - (yaw * 180) / Math.PI
  return ((deg % 360) + 360) % 360
}

export function replaySpan(r: Replay): [number, number] {
  const t = r.columns.relT
  return [t[0], t[t.length - 1]]
}
