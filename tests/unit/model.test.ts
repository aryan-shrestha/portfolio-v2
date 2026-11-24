import { Box3, Mesh, MeshLambertMaterial, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, HAIR_STYLES, OUTFITS, SWATCHES } from '@/engine/look'
import { buildCharacter } from '@/engine/model/build'

function accentMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = []
  root.traverse((o) => {
    if ((o as Mesh).isMesh && o.userData.accent) out.push(o as Mesh)
  })
  return out
}
const underDrawstring = (o: Object3D) => {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.name === 'drawstring') return true
  return false
}

describe('buildCharacter', () => {
  it('has two arms on sides -1 and 1', () => {
    const rig = buildCharacter(DEFAULT_LOOK)
    expect(rig.arms.map((a) => a.side)).toEqual([-1, 1])
  })

  it('tags only drawstring parts (2 strings + 2 tips) as accent, under the body', () => {
    const rig = buildCharacter(DEFAULT_LOOK)
    const acc = accentMeshes(rig.root)
    expect(acc).toHaveLength(4)
    for (const m of acc) {
      expect(underDrawstring(m)).toBe(true)
      expect(m.parent && rig.body.getObjectById(m.id)).toBeTruthy()
    }
  })

  it('accent materials write alpha 0.5 with blending disabled; others stay opaque', () => {
    const rig = buildCharacter(DEFAULT_LOOK)
    for (const m of accentMeshes(rig.root)) {
      const mat = m.material as MeshLambertMaterial
      expect(mat.opacity).toBe(0.5)
      expect(mat.blending).toBe(0) // NoBlending: alpha written as-is
    }
    const torsoMesh = rig.handleParts[1].children.find((c) => (c as Mesh).isMesh) as Mesh
    expect((torsoMesh.material as MeshLambertMaterial).opacity).toBe(1)
  })

  it('hoodie colour changes the torso material but not accent flags', () => {
    const torsoColour = (hoodie: string) => {
      const rig = buildCharacter({ ...DEFAULT_LOOK, base: { ...DEFAULT_LOOK.base, hoodie } })
      const mesh = rig.handleParts[1].children.find((c) => (c as Mesh).isMesh) as Mesh
      return { hex: (mesh.material as MeshLambertMaterial).color.getHexString(), accents: accentMeshes(rig.root).length }
    }
    const a = torsoColour('#55555c')
    const b = torsoColour('#2f4a6b')
    expect(a.hex).toBe('55555c')
    expect(b.hex).toBe('2f4a6b')
    expect(a.accents).toBe(b.accents)
  })

  it('rest silhouette stays within x [-1.8, 1.8] and top <= 3.05', () => {
    const rig = buildCharacter(DEFAULT_LOOK)
    rig.root.updateMatrixWorld(true)
    const box = new Box3().setFromObject(rig.root, true)
    expect(box.min.x).toBeGreaterThanOrEqual(-1.8)
    expect(box.max.x).toBeLessThanOrEqual(1.8)
    expect(box.max.y).toBeLessThanOrEqual(3.05)
  })

  it('exposes slots, bubble anchor and handle parts', () => {
    const rig = buildCharacter(DEFAULT_LOOK)
    expect(rig.slots.hands).toHaveLength(2)
    expect(rig.bubbleAnchor.position.toArray()).toEqual([-0.6, 1.45, 0])
    expect(rig.handleParts).toHaveLength(3)
  })

  it('dispose releases without throwing', () => {
    expect(() => buildCharacter(DEFAULT_LOOK).dispose()).not.toThrow()
  })
})

describe('look constants', () => {
  it('match spec 7.6', () => {
    expect(DEFAULT_LOOK.base).toEqual({ hair: 'wavy-fringe', hairColor: '#3a2f28', skin: '#efc6a2', hoodie: '#55555c', glasses: false })
    expect(DEFAULT_LOOK.outfit).toBe('hoodie')
    expect(SWATCHES.hair).toEqual(['#3a2f28', '#1a1a1a', '#6b4a2b', '#b8863b', '#9aa0a6'])
    expect(SWATCHES.skin).toEqual(['#efc6a2', '#f7dcc4', '#d9a47c', '#a8724f', '#6e4630'])
    expect(SWATCHES.hoodie).toEqual(['#55555c', '#2f4a6b', '#6b2f3a', '#3f5a3a', '#c9c4b8', '#1f1f22'])
    expect(HAIR_STYLES).toEqual(['wavy-fringe', 'short-crop', 'curly-top', 'buzz'])
    expect(OUTFITS).toEqual(['hoodie', 'blazer-bowtie', 'hardhat', 'detective'])
  })
})
