import { fmt } from '../sim/format'
import { Readout, ReadoutGrid, Section, Swatch } from './layout'
import { COLORS } from './tokens'
import { useCurrentSample } from './useCurrentSample'

/**
 * The headline number: live distance between the estimate and ground truth (the same value the
 * 3D drift tether is labelled with), and drift as a percentage of distance driven without GNSS.
 */
export function DriftReadout() {
  const { replay, t, i } = useCurrentSample()
  if (!replay) return null
  const c = replay.columns
  const dur = replay.durationS
  const err = c.posError[i]
  const dist = c.blackoutDist[i]
  const inBlackout = t >= 0 && t <= dur
  let drift = '–'
  let driftLabel = 'Drift so far'
  if (t > 0 && dist > 1) {
    if (inBlackout) drift = fmt((100 * err) / dist, 1)
    else {
      drift = fmt(replay.metrics.driftPct, 1)
      driftLabel = 'Window drift'
    }
  }
  const synthetic = replay.source === 'synthetic'

  return (
    <Section
      title="Position error · estimate vs truth"
      aside={
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <Swatch color={COLORS.tether} kind="dashed" />
          tether
        </span>
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div aria-label="Current position error" className="flex items-baseline gap-1">
          <span className="text-[30px] leading-none font-semibold tracking-tighter text-zinc-100 tabular-nums">{fmt(err, 1)}</span>
          <span className="text-[13px] font-medium text-zinc-500">m</span>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-zinc-500">{driftLabel}</div>
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-[20px] leading-tight font-semibold tracking-tight text-zinc-100 tabular-nums">{drift}</span>
            <span className="text-[11px] text-zinc-500">%</span>
          </div>
        </div>
      </div>
      <div className="mt-1 mb-2.5 text-[11px] text-zinc-500 tabular-nums">
        over {fmt(dist, 0)} m driven without GNSS
      </div>
      <ReadoutGrid>
        <Readout label="1σ radial" value={fmt(c.posSigma[i], 1)} unit="m" title="sqrt(P_xx + P_yy) of the EKF position covariance" />
        <Readout label="Endpoint err." value={fmt(replay.metrics.endpointErrorM, 1)} unit="m" title="Error at the end of the blackout (scored)" />
        <Readout
          label={synthetic ? 'Window (synth.)' : 'Window, verified'}
          value={fmt(replay.verifiedDriftPct ?? replay.metrics.driftPct, 2)}
          unit="%"
          title="This window's drift in results/sih/eval_windows_sih_mvp_anomaly.csv; the replay reproduces it exactly"
        />
      </ReadoutGrid>
    </Section>
  )
}
