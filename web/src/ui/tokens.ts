/** Colour tokens for SVG and three.js; keep in sync with the @theme block in index.css. */
export const COLORS = {
  surface: '#18181b',
  panel: '#1c1c1f',
  ink: '#e4e4e7',
  inkMuted: '#71717a',
  truth: '#60a46f',
  estimate: '#558dc6',
  motionnet: '#b9883c',
  degraded: '#bd6251',
  tether: '#c9c9ce',
} as const

/** Scene-only material colours (sRGB). Matte clay tones, no pure black/white. */
export const SCENE = {
  background: '#18181b',
  ground: '#2a2a2e',
  gridCell: '#333339',
  gridSection: '#44444c',
  route: '#3a4a3f',
  cabin: '#2e3136',
  tyre: '#1e1f22',
  trim: '#8d9199',
  uncertainty: '#9aa5b3',
  post: '#8a8a90',
} as const
