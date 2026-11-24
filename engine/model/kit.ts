import { Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, NoBlending } from 'three'
import type { BufferGeometry, Material, Object3D } from 'three'

/** Luminance stand-in for accent parts; the accent flag (alpha 0.5) selects vermilion, not this colour. */
export const ACCENT_STAND_IN = '#5f8f5f'
const DARK = '#000000'

/**
 * Part factory that owns what it creates: every geometry and material made through a kit is freed by
 * its `dispose()`. The base body has one kit; each swappable layer (hair, outfit, glasses) gets its
 * own, so a swap frees exactly what it replaces.
 */
export type Kit = {
  /** Lit part with an inverted-hull ink outline (unless `outline: false`). */
  part(geo: BufferGeometry, color: string, opts?: { outline?: boolean }): Group
  /** Accent part (spec §7.2): dithers vermilion + white; its outline stays ink. */
  accent(geo: BufferGeometry): Group
  /** Unlit mesh (eyes, brows, lenses' rims). */
  flat(geo: BufferGeometry, color?: string): Mesh
  /** Lit mesh without an outline (stubble). */
  lit(geo: BufferGeometry, color: string): Mesh
  dispose(): void
}

/** Hidden parts are scaled to zero too: Box3 ignores `visible`, so this keeps them out of the silhouette. */
export const hide = (o: Object3D) => {
  o.scale.setScalar(0)
  o.visible = false
}
export const show = (o: Object3D) => {
  o.scale.setScalar(1)
  o.visible = true
}

export const at = <T extends Object3D>(o: T, x: number, y: number, z: number): T => (o.position.set(x, y, z), o)

/** Outline meshes are tagged so silhouette maths can skip them (same geometry, same transform). */
export const OUTLINE = 'outline'

export function createKit(outline: Material): Kit {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const track = <G extends BufferGeometry>(g: G): G => (geometries.add(g), g)
  const keep = <M extends Material>(m: M): M => (materials.add(m), m)

  const lambert = (color: string, accent = false) =>
    // Accent flag channel: alpha 0.5. Three only forces alpha to 1 for NormalBlending opaque materials,
    // so NoBlending lets the fragment alpha reach the render target as-is.
    keep(new MeshLambertMaterial(accent ? { color, opacity: 0.5, blending: NoBlending } : { color }))
  const hull = (geo: BufferGeometry) => {
    const m = new Mesh(geo, outline)
    m.userData[OUTLINE] = true
    return m
  }

  return {
    part(geo, color, { outline: withOutline = true } = {}) {
      track(geo)
      const g = new Group()
      g.add(new Mesh(geo, lambert(color)))
      if (withOutline) g.add(hull(geo))
      return g
    },
    accent(geo) {
      track(geo)
      const g = new Group()
      const m = new Mesh(geo, lambert(ACCENT_STAND_IN, true))
      m.userData.accent = true
      g.add(m, hull(geo))
      return g
    },
    flat(geo, color = DARK) {
      return new Mesh(track(geo), keep(new MeshBasicMaterial({ color })))
    },
    lit(geo, color) {
      return new Mesh(track(geo), lambert(color))
    },
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      geometries.clear()
      materials.clear()
    },
  }
}
