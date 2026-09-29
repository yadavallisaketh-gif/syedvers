import { CAMERA_MODES, type CameraMode, type Layers, useSim } from '../sim/store'
import { SegmentedControl, Toggle } from './controls'
import { Section, Swatch } from './layout'
import { COLORS, SCENE } from './tokens'

const LAYERS: { key: keyof Layers; label: string; swatch: React.ReactNode }[] = [
  { key: 'ghost', label: 'Ground-truth ghost', swatch: <Swatch color={COLORS.truth} /> },
  { key: 'tether', label: 'Drift tether', swatch: <Swatch color={COLORS.tether} kind="dashed" /> },
  { key: 'uncertainty', label: '1σ volume', swatch: <Swatch color={SCENE.uncertainty} kind="dot" /> },
  { key: 'route', label: 'Full route', swatch: <Swatch color={SCENE.route} kind="line" /> },
  { key: 'grid', label: '10 m grid', swatch: <Swatch color={SCENE.gridSection} /> },
]

export function SceneControls() {
  const camera = useSim((s) => s.camera)
  const layers = useSim((s) => s.layers)
  const { setCamera, toggleLayer } = useSim.getState()
  return (
    <Section title="Scene">
      <SegmentedControl<CameraMode>
        label="Camera"
        value={camera}
        onChange={setCamera}
        options={CAMERA_MODES.map((m) => ({ value: m.id, label: m.label, hint: m.key }))}
      />
      <div className="mt-2 grid grid-cols-2 gap-x-3">
        {LAYERS.map((l) => (
          <Toggle key={l.key} checked={layers[l.key]} onChange={() => toggleLayer(l.key)} label={l.label} swatch={l.swatch} />
        ))}
      </div>
    </Section>
  )
}
