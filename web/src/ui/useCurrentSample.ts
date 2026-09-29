import { sampleIndex } from '../sim/sampling'
import { useSim } from '../sim/store'

/** Replay + UI-rate time + the sample at or before it. */
export function useCurrentSample() {
  const replay = useSim((s) => s.replay)
  const t = useSim((s) => s.t)
  const i = replay ? sampleIndex(replay.columns.relT, t) : 0
  return { replay, t, i }
}
