import { MODE_DR, MODE_GNSS, type Replay } from './types'

/*
 * Labelled placeholder replay: used only when web/public/data/index.json is absent (no engine export).
 * It has the exact shape of an engine replay so the whole UI works, but none of it comes from the
 * engine. The UI tags it SYNTHETIC everywhere a number is shown. Generate real replays with
 *   python scripts/export_web_data.py
 */

const SOURCES = ['gnss_pos', 'gnss_speed', 'gnss_heading', 'motionnet', 'nhc', 'zupt', 'zaru', 'map_position', 'map_heading']
const src = (name: string) => SOURCES.indexOf(name)

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeSyntheticReplay(seed = 26168): Replay {
  const rand = mulberry32(seed)
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())
  const rate = 10
  const before = 20
  const duration = 60
  const after = 15
  const n = (before + duration + after) * rate + 1
  const dt = 1 / rate
  const timeout = 1.5

  const relT = new Float64Array(n)
  const truthX = new Float64Array(n)
  const truthY = new Float64Array(n)
  const truthYaw = new Float64Array(n)
  const truthSpeed = new Float64Array(n)
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const yaw = new Float64Array(n)
  const vF = new Float64Array(n)
  const vL = new Float64Array(n)
  const posSigma = new Float64Array(n)
  const pXX = new Float64Array(n)
  const pYY = new Float64Array(n)
  const pXY = new Float64Array(n)
  const mode = new Uint8Array(n)
  const denied = new Uint8Array(n)
  const mnSpeed = new Float64Array(n).fill(Number.NaN)
  const mnSigma = new Float64Array(n).fill(Number.NaN)
  const posError = new Float64Array(n)
  const blackoutDist = new Float64Array(n)

  // ground truth: a winding road, speed 10-17 m/s
  let tx = 0
  let ty = 0
  let th = 0.35
  for (let k = 0; k < n; k++) {
    const t = -before + k * dt
    relT[k] = t
    const v = 13.5 + 3 * Math.sin(t / 9) + 0.8 * Math.sin(t / 2.7)
    const kappa = 0.011 * Math.sin(t / 11) + 0.006 * Math.sin(t / 4.3 + 1)
    truthSpeed[k] = v
    if (k > 0) {
      th += v * kappa * dt
      tx += v * Math.cos(th) * dt
      ty += v * Math.sin(th) * dt
    }
    truthX[k] = tx
    truthY[k] = ty
    truthYaw[k] = th
  }
  const k0 = before * rate
  const ax = truthX[k0]
  const ay = truthY[k0]
  for (let k = 0; k < n; k++) {
    truthX[k] -= ax
    truthY[k] -= ay
  }

  // estimate: tracks GNSS before, drifts in the blackout (heading + scale error), re-anchors after
  let ex = 0
  let ey = 0
  let headErr = 0
  const scale = 1 + 0.035 * gauss()
  const headBias = 0.0011 * (rand() < 0.5 ? -1 : 1)
  let dist = 0
  const upd = { t: [] as number[], s: [] as number[], a: [] as number[], nis: [] as number[] }
  for (let k = 0; k < n; k++) {
    const t = relT[k]
    const inside = t >= 0 && t < duration
    denied[k] = inside ? 1 : 0
    mode[k] = inside && t >= timeout ? MODE_DR : MODE_GNSS
    if (k > 0 && inside) dist += Math.hypot(truthX[k] - truthX[k - 1], truthY[k] - truthY[k - 1])
    blackoutDist[k] = dist

    let sAlong: number
    let sCross: number
    if (t < 0) {
      ex = truthX[k] + 0.25 * gauss()
      ey = truthY[k] + 0.25 * gauss()
      yaw[k] = truthYaw[k] + 0.01 * gauss()
      sAlong = sCross = 0.9
    } else if (inside) {
      headErr += headBias * dt + 0.0009 * gauss()
      yaw[k] = truthYaw[k] + headErr
      const v = truthSpeed[k] * scale + 0.15 * gauss()
      ex += v * Math.cos(yaw[k]) * dt
      ey += v * Math.sin(yaw[k]) * dt
      sAlong = 0.9 + 0.012 * t * truthSpeed[k] * 0.2
      sCross = 0.9 + 0.0009 * t * t * 1.4
      mnSpeed[k] = truthSpeed[k] + 0.6 * gauss()
      mnSigma[k] = 0.9 + 0.2 * rand()
    } else {
      const a = 1 - Math.exp(-dt / 1.2)
      ex += (truthX[k] - ex) * a
      ey += (truthY[k] - ey) * a
      yaw[k] = truthYaw[k] + (yaw[k - 1] - truthYaw[k - 1]) * (1 - a)
      const tail = Math.exp(-(t - duration) / 2)
      sAlong = 0.9 + (posSigma[k - 1] - 0.9) * tail * 0.9
      sCross = sAlong
    }
    x[k] = ex
    y[k] = ey
    vF[k] = truthSpeed[k] * (inside ? scale : 1) + 0.1 * gauss()
    vL[k] = 0.05 * gauss()
    // covariance: along-track / cross-track sigmas rotated into East/North
    const c = Math.cos(yaw[k])
    const s = Math.sin(yaw[k])
    const a2 = sAlong * sAlong
    const c2 = sCross * sCross
    pXX[k] = a2 * c * c + c2 * s * s
    pYY[k] = a2 * s * s + c2 * c * c
    pXY[k] = (a2 - c2) * c * s
    posSigma[k] = Math.sqrt(pXX[k] + pYY[k])
    posError[k] = Math.hypot(x[k] - truthX[k], y[k] - truthY[k])

    // a plausible update stream at 10 Hz
    const push = (name: string, ok: boolean, nis: number) => {
      upd.t.push(t)
      upd.s.push(src(name))
      upd.a.push(ok ? 1 : 0)
      upd.nis.push(nis)
    }
    if (!inside) push('gnss_pos', true, Math.abs(gauss()) * 1.2)
    if (!inside && k % 10 === 0) push('gnss_speed', true, Math.abs(gauss()))
    push('nhc', true, Math.abs(gauss()))
    if (mode[k] === MODE_DR) push('motionnet', true, Math.abs(gauss()) * 1.1)
    if (mode[k] === MODE_DR && k % 7 === 0) {
      const nis = Math.abs(gauss()) * 2.5
      push('map_position', nis < 6.6, nis)
    }
  }

  const kEnd = (before + duration) * rate - 1
  const drift = (100 * posError[kEnd]) / blackoutDist[kEnd]
  const updates = {
    relT: Float64Array.from(upd.t),
    source: Uint8Array.from(upd.s),
    accepted: Uint8Array.from(upd.a),
    nis: Float64Array.from(upd.nis),
  }

  return {
    source: 'synthetic',
    id: 'SYNTH',
    drive: 'SYN',
    tStart: 0,
    tEnd: duration,
    durationS: duration,
    rateHz: rate,
    samples: n,
    profile: { config: 'synthetic placeholder', variant: '-', leverArmX: 1.8, nhcSigma: 0.15, gnssTimeoutS: timeout },
    metrics: {
      driftPct: drift,
      endpointErrorM: posError[kEnd],
      distanceM: blackoutDist[kEnd],
      ateM: null,
      speedRmseMps: null,
      headingMaeDeg: null,
      reacqMaxStepM: null,
    },
    verifiedDriftPct: null,
    gnssUpdatesInBlackout: 0,
    mountYawDeg: null,
    modes: ['WAITING FOR GNSS', 'GNSS+INS', 'DEAD RECKONING'],
    sources: SOURCES,
    columns: {
      relT, x, y, yaw, vF, vL, posSigma, pXX, pYY, pXY, mode, denied,
      truthX, truthY, truthYaw, truthSpeed, mnSpeed, mnSigma, posError, blackoutDist,
    },
    updates,
    anomalies: [],
  }
}
