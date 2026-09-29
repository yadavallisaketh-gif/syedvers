import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, MeshStandardMaterial } from 'three'

import { frame, sceneX, sceneZ } from './frame'

/**
 * A path drawn as a flat, matte strip lying on the ground (real lit geometry that receives
 * shadows and ambient occlusion, rather than a screen-space line).
 *
 * The centreline is stored per vertex and pushed sideways in the vertex shader by
 * `aOffset * uHalfWidth`, so the width can follow the zoom level (at least `minPx` pixels)
 * without rebuilding geometry. `progressive` draws only up to the playhead.
 */
export function TrackRibbon({
  xs,
  ys,
  color,
  halfWidth,
  minPx = 1.2,
  height,
  layer,
  progressive = false,
}: {
  xs: Float64Array
  ys: Float64Array
  color: string
  halfWidth: number
  minPx?: number
  height: number
  layer: number
  progressive?: boolean
}) {
  const geometry = useMemo(() => buildRibbon(xs, ys, height), [xs, ys, height])

  const material = useMemo(() => {
    const uniforms = { uHalfWidth: { value: halfWidth } }
    const m = new MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1 - layer,
      polygonOffsetUnits: -4 - 4 * layer,
    })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uHalfWidth = uniforms.uHalfWidth
      shader.vertexShader =
        'attribute vec3 aOffset;\nuniform float uHalfWidth;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += aOffset * uHalfWidth;')
    }
    m.userData.uniforms = uniforms
    return m
  }, [color, halfWidth, layer])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    ;(material.userData.uniforms as { uHalfWidth: { value: number } }).uHalfWidth.value = Math.max(
      halfWidth,
      minPx * frame.worldPerPx,
    )
    if (progressive) geometry.setDrawRange(0, 6 * frame.cursor.i)
  })

  return <mesh geometry={geometry} material={material} receiveShadow frustumCulled={false} renderOrder={layer} />
}

function buildRibbon(xs: Float64Array, ys: Float64Array, height: number): BufferGeometry {
  const n = xs.length
  // hold the last finite point through gaps (the reference track can be briefly invalid)
  const px = new Float64Array(n)
  const pz = new Float64Array(n)
  let lx = Number.NaN
  let lz = Number.NaN
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      lx = sceneX(xs[i])
      lz = sceneZ(ys[i])
    }
    px[i] = lx
    pz[i] = lz
  }
  const first = px.findIndex((v) => Number.isFinite(v))
  for (let i = 0; i < first; i++) {
    px[i] = px[first]
    pz[i] = pz[first]
  }

  const position = new Float32Array(n * 2 * 3)
  const offset = new Float32Array(n * 2 * 3)
  const normal = new Float32Array(n * 2 * 3)
  let nx = 0
  let nz = 1
  for (let i = 0; i < n; i++) {
    const a = Math.max(i - 1, 0)
    const b = Math.min(i + 1, n - 1)
    const tx = px[b] - px[a]
    const tz = pz[b] - pz[a]
    const len = Math.hypot(tx, tz)
    if (len > 1e-4) {
      // perpendicular in the ground plane (keep the previous one while stationary)
      nx = -tz / len
      nz = tx / len
    }
    for (let s = 0; s < 2; s++) {
      const v = (2 * i + s) * 3
      const side = s === 0 ? 1 : -1
      position[v] = px[i]
      position[v + 1] = height
      position[v + 2] = pz[i]
      offset[v] = nx * side
      offset[v + 2] = nz * side
      normal[v + 1] = 1
    }
  }

  const index = new Uint32Array(Math.max(n - 1, 0) * 6)
  for (let i = 0; i < n - 1; i++) {
    const l0 = 2 * i
    const r0 = l0 + 1
    const l1 = l0 + 2
    const r1 = l0 + 3
    // wind every triangle counter-clockwise seen from above so the face normal is +y
    const up = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) =>
      (bz - az) * (cx - ax) - (bx - ax) * (cz - az) >= 0
    const x = (k: number) => position[k * 3] + offset[k * 3]
    const z = (k: number) => position[k * 3 + 2] + offset[k * 3 + 2]
    const tri = (o: number, p: number, q: number, r: number) => {
      if (up(x(p), z(p), x(q), z(q), x(r), z(r))) index.set([p, q, r], o)
      else index.set([p, r, q], o)
    }
    tri(i * 6, l0, r0, l1)
    tri(i * 6 + 3, r0, r1, l1)
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(position, 3))
  g.setAttribute('aOffset', new BufferAttribute(offset, 3))
  g.setAttribute('normal', new BufferAttribute(normal, 3))
  g.setIndex(new BufferAttribute(index, 1))
  g.computeBoundingSphere()
  return g
}
