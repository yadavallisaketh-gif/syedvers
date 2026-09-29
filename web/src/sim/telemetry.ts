import { fmt, fmtSigned } from './format'
import { MODE_DR, type Replay } from './types'

/*
 * The raw telemetry console is a pure function of (replay, time): every line is precomputed from the
 * replay once. Channels: EKF (v_f, v_l, 1σ), MNET (speed ± σ), DRIFT (error, change per second),
 * UPD (accepted measurement updates in the last second; nhc~n = NHC skipped by turn gating),
 * REJ (χ² rejections), MODE / EVT / ANOM / SYS events.
 *
 * The console shows the lines with t <= playhead. Scrubbing backwards therefore
 * rewinds the log exactly, instead of leaving stale lines behind.
 */

export type LogKind = 'SYS' | 'EVT' | 'MODE' | 'EKF' | 'MNET' | 'DRIFT' | 'UPD' | 'REJ' | 'ANOM'

export interface LogEntry {
  t: number
  kind: LogKind
  text: string
}

const EVERY = 10 // samples: channels report once a second at 10 Hz
const DRIFT_PHASE = 5 // DRIFT lines land half a second after EKF/MNET/UPD

const SHORT: Record<string, string> = {
  gnss_pos: 'gpos',
  gnss_speed: 'gspd',
  gnss_heading: 'ghdg',
  motionnet: 'mnet',
  nhc: 'nhc',
  zupt: 'zupt',
  zaru: 'zaru',
  map_position: 'mpos',
  map_heading: 'mhdg',
}

const MODE_TEXT = ['WAITING FOR GNSS', 'GNSS+INS', 'DEAD RECKONING']

export function buildTelemetry(r: Replay): LogEntry[] {
  const c = r.columns
  const n = c.relT.length
  const out: LogEntry[] = []
  const t0 = c.relT[0]

  out.push({
    t: t0,
    kind: 'SYS',
    text: `replay ${r.id} · ${r.source === 'engine' ? `variant ${r.profile.variant} · ${r.profile.config}` : 'SYNTHETIC placeholder, not engine output'}`,
  })
  out.push({
    t: t0,
    kind: 'SYS',
    text: `lever arm r_x ${fmt(r.profile.leverArmX, 2)} m · NHC σ ${fmt(r.profile.nhcSigma, 2)} m/s · GNSS timeout ${fmt(r.profile.gnssTimeoutS, 1)} s`,
  })
  if (r.mountYawDeg !== null) {
    out.push({ t: t0, kind: 'SYS', text: `phone→vehicle yaw ${fmt(r.mountYawDeg, 1)}° (fit on pre-blackout data only)` })
  }

  // discrete transitions
  let mnActive = false
  for (let k = 1; k < n; k++) {
    const t = c.relT[k]
    if (c.denied[k] && !c.denied[k - 1]) {
      out.push({ t, kind: 'EVT', text: `GNSS cut · ${fmt(r.durationS, 0)} s blackout · estimator GNSS input masked` })
    }
    if (!c.denied[k] && c.denied[k - 1]) {
      out.push({ t, kind: 'EVT', text: `GNSS restored · ${r.gnssUpdatesInBlackout} GNSS updates inside blackout` })
      const m = r.metrics
      out.push({
        t,
        kind: 'SYS',
        text: `window scored: drift ${fmt(m.driftPct, 2)} % · endpoint ${fmt(m.endpointErrorM, 1)} m over ${fmt(m.distanceM, 0)} m`,
      })
    }
    if (c.mode[k] !== c.mode[k - 1]) {
      out.push({ t, kind: 'MODE', text: `${MODE_TEXT[c.mode[k - 1]]} → ${MODE_TEXT[c.mode[k]]}` })
    }
    const mnNow = Number.isFinite(c.mnSpeed[k])
    if (mnNow !== mnActive) {
      out.push({ t, kind: 'EVT', text: mnNow ? 'MotionNet speed pseudo-measurement active' : 'MotionNet idle' })
      mnActive = mnNow
    }
  }

  // periodic channels: filter state, MotionNet output (dead reckoning only), drift
  for (let k = 0; k < n; k += EVERY) {
    out.push({ t: c.relT[k], kind: 'EKF', text: `v_f ${fmt(c.vF[k], 2)} v_l ${fmtSigned(c.vL[k], 2)} σ ${fmt(c.posSigma[k], 1)}` })
    if (c.mode[k] === MODE_DR && Number.isFinite(c.mnSpeed[k])) {
      out.push({ t: c.relT[k], kind: 'MNET', text: `${fmt(c.mnSpeed[k], 2)} ± ${fmt(c.mnSigma[k], 2)} m/s` })
    }
  }
  for (let k = DRIFT_PHASE; k < n; k += EVERY) {
    const dErr = c.posError[k] - c.posError[Math.max(k - EVERY, 0)]
    out.push({ t: c.relT[k], kind: 'DRIFT', text: `err ${fmt(c.posError[k], 2)} m Δ ${fmtSigned(dErr, 2)}/s` })
  }

  // measurement updates: per-second summary + every chi-square rejection
  const u = r.updates
  let j = 0
  for (let k = EVERY; k < n; k += EVERY) {
    const tEnd = c.relT[k]
    const acc = new Map<string, number>()
    let gated = 0
    for (; j < u.relT.length && u.relT[j] <= tEnd; j++) {
      const name = SHORT[r.sources[u.source[j]]] ?? r.sources[u.source[j]]
      if (u.accepted[j]) acc.set(name, (acc.get(name) ?? 0) + 1)
      else if (!Number.isFinite(u.nis[j])) gated++
    }
    const parts = [...acc].map(([name, count]) => `${name} ${count}`)
    if (gated) parts.push(`nhc~${gated}`)
    out.push({ t: tEnd, kind: 'UPD', text: parts.length ? parts.join(' ') : 'no updates' })
  }
  for (let q = 0; q < u.relT.length; q++) {
    if (!u.accepted[q] && Number.isFinite(u.nis[q])) {
      out.push({ t: u.relT[q], kind: 'REJ', text: `${r.sources[u.source[q]]} NIS ${fmt(u.nis[q], 2)} > χ² gate` })
    }
  }

  for (const a of r.anomalies) {
    const what =
      a.kind === 'slip' ? 'mount slip → re-level, b_l reopened' : `${a.kind} → accel noise ×100 for 1 s`
    out.push({ t: a.relT, kind: 'ANOM', text: `${what} · magnitude ${fmt(a.magnitude, 2)} · ${a.mode}` })
  }

  const order: Record<LogKind, number> = { SYS: 0, EVT: 1, MODE: 2, ANOM: 3, REJ: 4, UPD: 5, EKF: 6, MNET: 7, DRIFT: 8 }
  return out.sort((a, b) => a.t - b.t || order[a.kind] - order[b.kind])
}
