import { Vector3 } from 'three'
import type { Box3, Mesh, Object3D } from 'three'
import { OUTLINE } from './model/kit'

const v = new Vector3()

/**
 * Exact silhouette box of `root` (spec §7.5.1), the same as `Box3.setFromObject(root, true)` but
 * skipping the ink-outline meshes: each shares its part's geometry and transform, so it adds the very
 * same points (about half the vertices). Like Box3, it ignores `visible`: hidden parts are scaled to 0.
 */
export function silhouette(root: Object3D, box: Box3): Box3 {
  box.makeEmpty()
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || m.userData[OUTLINE]) return
    const pos = m.geometry.getAttribute('position')
    if (!pos) return
    for (let i = 0, n = pos.count; i < n; i++)
      box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld))
  })
  return box
}
