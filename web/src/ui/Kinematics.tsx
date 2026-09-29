import { KMH, fmt, fmtSigned } from '../sim/format'
import { bearingDeg, wrapAngle } from '../sim/sampling'
import { Readout, ReadoutGrid, Section, Swatch } from './layout'
import { COLORS } from './tokens'
import { useCurrentSample } from './useCurrentSample'

export function Kinematics() {
  const { replay, i } = useCurrentSample()
  if (!replay) return null
  const c = replay.columns
  const mn = c.mnSpeed[i]
  const headingErr = (wrapAngle(c.yaw[i] - c.truthYaw[i]) * 180) / Math.PI

  return (
    <Section title="Kinematics">
      <ReadoutGrid>
        <Readout
          label="EKF v_f"
          swatch={<Swatch color={COLORS.estimate} />}
          value={fmt(c.vF[i] * KMH, 1)}
          unit="km/h"
          title="Forward velocity state of the EKF"
        />
        <Readout
          label="MotionNet"
          swatch={<Swatch color={COLORS.motionnet} kind="dot" />}
          value={Number.isFinite(mn) ? fmt(mn * KMH, 1) : 'idle'}
          unit={Number.isFinite(mn) ? `±${fmt(c.mnSigma[i] * KMH, 1)}` : undefined}
          title="MotionNet runs only in dead reckoning; its output (±1σ) is the EKF's speed measurement"
        />
        <Readout label="Truth" swatch={<Swatch color={COLORS.truth} />} value={fmt(c.truthSpeed[i] * KMH, 1)} unit="km/h" />
        <Readout label="Heading" value={fmt(bearingDeg(c.yaw[i]), 1)} unit="°" title="EKF heading as a compass bearing" />
        <Readout label="Heading err." value={fmtSigned(headingErr, 2)} unit="°" title="EKF heading minus true heading" />
        <Readout label="Lateral v_l" value={fmtSigned(c.vL[i], 2)} unit="m/s" title="Lateral velocity state (held near 0 by the NHC)" />
      </ReadoutGrid>
    </Section>
  )
}
