const DASH = '–'

/** Fixed decimals; NaN/null -> en dash. */
export function fmt(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? DASH : v.toFixed(digits)
}

export function fmtSigned(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH
  return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(digits)
}

/** Replay time for the telemetry console: +41.00 / −19.50 */
export function fmtStamp(t: number): string {
  const s = Math.abs(t).toFixed(2).padStart(5, '0')
  return (t < 0 ? '−' : '+') + s
}

/** Short replay time for readouts: T+12.4 s */
export function fmtRelT(t: number): string {
  return `T${t < 0 ? '−' : '+'}${Math.abs(t).toFixed(1)}`
}

export const KMH = 3.6
