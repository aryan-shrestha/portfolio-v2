import { Box3, Mesh, MeshBasicMaterial, MeshLambertMaterial, Vector3, type BufferGeometry, type Material, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, HAIR_STYLES, OUTFITS, SWATCHES, type Look } from '@/engine/look'
import { buildCharacter, type Rig } from '@/engine/model/build'
import { applyHair } from '@/engine/model/hair'
import { RIM, RIM_NAME } from '@/engine/model/kit'
import { applyOutfit } from '@/engine/model/outfits'
import type { HairStyle, OutfitId } from '@/engine/types'

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

  it('rest silhouette stays within x [-1.8, 1.8] and top <= 3.05 (Aryan’s own look)', () => {
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

const lookOf = (hair: HairStyle, outfit: OutfitId, extra: Partial<Look['base']> = {}): Look => ({
  base: { ...DEFAULT_LOOK.base, hair, ...extra },
  outfit,
})
const named = (rig: Rig, name: string) => rig.root.getObjectByName(name)
const worldBox = (o: Object3D) => new Box3().setFromObject(o, true)
const lambertColour = (g: Object3D) => ((g.children.find((c) => (c as Mesh).isMesh) as Mesh).material as MeshLambertMaterial).color.getHexString()

/** Every geometry and material reachable from the rig's root. */
function resources(rig: Rig) {
  const geos = new Set<BufferGeometry>()
  const mats = new Set<Material>()
  rig.root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    geos.add(m.geometry)
    ;(Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x))
  })
  return { geos, mats }
}

describe('outfits (spec §6.2)', () => {
  it('blazer-bowtie: the bow tie is the only accent he shows; drawstrings hidden; torso and sleeves repainted', () => {
    const rig = buildCharacter(lookOf('wavy-fringe', 'blazer-bowtie'))
    const shown = accentMeshes(rig.root).filter((m) => {
      for (let p: Object3D | null = m; p; p = p.parent) if (!p.visible || p.scale.x === 0) return false
      return true
    })
    expect(shown).toHaveLength(3) // two wings + knot
    for (const m of shown) {
      expect(named(rig, 'bowtie')!.getObjectById(m.id)).toBeTruthy()
      expect((m.material as MeshLambertMaterial).opacity).toBe(0.5)
    }
    expect(lambertColour(rig.handleParts[1])).toBe('17181c')
    expect(named(rig, 'blazer-v')).toBeTruthy()
  })

  it('taking the blazer off restores the hoodie colour and the drawstrings', () => {
    const look = lookOf('wavy-fringe', 'blazer-bowtie', { hoodie: '#2f4a6b' })
    const rig = buildCharacter(look)
    applyOutfit(rig, 'hoodie')
    expect(lambertColour(rig.handleParts[1])).toBe('2f4a6b')
    expect(rig.drawstrings.every((d) => d.visible && d.scale.x === 1)).toBe(true)
    expect(named(rig, 'bowtie')).toBeUndefined()
  })

  it('the bow tie sits on the front of the hoodie collar, centred', () => {
    const rig = buildCharacter(lookOf('wavy-fringe', 'blazer-bowtie'))
    rig.root.updateMatrixWorld(true)
    const bow = worldBox(named(rig, 'bowtie')!)
    const collar = worldBox(rig.body.children[1]) // torso, collar, hood back …
    expect(bow.getCenter(new Vector3()).x).toBeCloseTo(0, 6)
    expect(bow.min.z).toBeGreaterThan(collar.max.z - 0.15) // in front, not buried in the collar
    expect(bow.max.y).toBeGreaterThan(collar.min.y)
    expect(bow.min.y).toBeLessThan(collar.max.y)
  })

  it('hats sit on his head: brim above the brows, crown over every hair style except curly-top', () => {
    for (const outfit of ['hardhat', 'detective'] as const) {
      for (const hair of HAIR_STYLES) {
        const rig = buildCharacter(lookOf(hair, outfit))
        rig.root.updateMatrixWorld(true)
        const hat = worldBox(rig.slots.hat)
        const skull = worldBox(rig.handleParts[0])
        const face = rig.face.getWorldPosition(new Vector3())
        expect(hat.min.y, `${outfit} ${hair}`).toBeGreaterThan(face.y + 0.27) // brows
        expect(hat.min.y, `${outfit} ${hair}`).toBeLessThan(skull.max.y)
        const hairTop = Math.max(...rig.layers.hair!.objects.map((o) => worldBox(o).max.y))
        expect(hat.max.y, `${outfit} ${hair}: hair pokes through`).toBeGreaterThan(hairTop)
      }
    }
  })

  it('a hat hides the curly-top crown; taking it off shows it again', () => {
    const rig = buildCharacter(lookOf('curly-top', 'hardhat'))
    const crown = rig.layers.hair!.crown!
    expect(crown.visible).toBe(false)
    expect(crown.scale.x).toBe(0)
    applyOutfit(rig, 'hoodie')
    expect(crown.visible).toBe(true)
    expect(crown.scale.x).toBe(1)
    applyHair(rig, 'curly-top', '#1a1a1a') // re-dressing the hair under a hat hides the new crown
    applyOutfit(rig, 'detective')
    expect(rig.layers.hair!.crown!.scale.x).toBe(0)
  })

  it('props go in the hand he points with in that chapter: wrench left (Bevlytics), magnifier right (DTI)', () => {
    const wrench = buildCharacter(lookOf('wavy-fringe', 'hardhat'))
    expect(wrench.slots.hands[0].getObjectByName('wrench')).toBeTruthy()
    expect(wrench.slots.hands[1].children).toHaveLength(0)
    const glass = buildCharacter(lookOf('wavy-fringe', 'detective'))
    expect(glass.slots.hands[1].getObjectByName('magnifier')).toBeTruthy()
    expect(glass.slots.hands[0].children).toHaveLength(0)
    expect(glass.slots.hat.getObjectByName('deerstalker')).toBeTruthy()
    expect(buildCharacter(DEFAULT_LOOK).slots.hat.children).toHaveLength(0)
  })

  it('rest silhouette of every hair × outfit stays within x [-1.8, 1.8]', () => {
    for (const hair of HAIR_STYLES)
      for (const outfit of OUTFITS) {
        const rig = buildCharacter(lookOf(hair, outfit, { glasses: true }))
        rig.root.updateMatrixWorld(true)
        const b = new Box3().setFromObject(rig.root, true)
        expect(b.min.x, `${hair} ${outfit}`).toBeGreaterThanOrEqual(-1.8)
        expect(b.max.x, `${hair} ${outfit}`).toBeLessThanOrEqual(1.8)
      }
  })
})

describe('hair styles (spec §7.6)', () => {
  it('every style builds, is distinct, and its cap is the grab handle hair part', () => {
    const tops = new Map<HairStyle, number>()
    for (const hair of HAIR_STYLES) {
      const rig = buildCharacter(lookOf(hair, 'hoodie'))
      expect(rig.layers.hair!.id).toBe(hair)
      expect(rig.handleParts[2].parent).toBe(rig.face)
      expect(rig.layers.hair!.objects).toContain(rig.handleParts[2])
      rig.root.updateMatrixWorld(true)
      tops.set(hair, Math.max(...rig.layers.hair!.objects.map((o) => worldBox(o).max.y)))
    }
    // curly-top is the tallest, buzz the closest to the skull
    expect(tops.get('curly-top')!).toBeGreaterThan(tops.get('wavy-fringe')!)
    expect(tops.get('buzz')!).toBeLessThan(tops.get('short-crop')!)
    expect(new Set(tops.values()).size).toBe(4)
  })

  it('hair colour paints the hair, brows and moustache', () => {
    const rig = buildCharacter(lookOf('buzz', 'hoodie', { hairColor: '#b8863b' }))
    expect(lambertColour(rig.handleParts[2])).toBe('b8863b')
    expect(rig.paint.hair).toHaveLength(4)
    for (const m of rig.paint.hair) expect((m as MeshBasicMaterial).color.getHexString()).toBe('b8863b')
    applyHair(rig, 'short-crop', '#9aa0a6')
    for (const m of rig.paint.hair) expect(m.color.getHexString()).toBe('9aa0a6')
  })

  it('glasses add rims on his face only when asked for', () => {
    expect(named(buildCharacter(DEFAULT_LOOK), 'glasses')).toBeUndefined()
    const rig = buildCharacter(lookOf('wavy-fringe', 'hoodie', { glasses: true }))
    expect(named(rig, 'glasses')!.parent).toBe(rig.face)
  })
})

describe('swaps free what they replace (no leaks across dress-up changes)', () => {
  it('cycling every outfit and hair style 5 times disposes every replaced geometry and material', () => {
    const rig = buildCharacter(DEFAULT_LOOK)
    const disposed = new Set<object>()
    const watch = () => {
      const { geos, mats } = resources(rig)
      for (const r of [...geos, ...mats]) {
        const t = r as { hasEventListener(e: string, f: () => void): boolean; addEventListener(e: 'dispose', f: () => void): void }
        if (!t.hasEventListener('dispose', mark)) t.addEventListener('dispose', mark)
      }
      return { geos, mats }
    }
    function mark(this: object) {
      disposed.add(this) // three calls dispose listeners with the disposed object as `this`
    }
    const before = watch()
    const seen = new Set<object>([...before.geos, ...before.mats])
    for (let i = 0; i < 5; i++)
      for (const outfit of OUTFITS)
        for (const hair of HAIR_STYLES) {
          applyOutfit(rig, outfit)
          applyHair(rig, hair, SWATCHES.hair[i % SWATCHES.hair.length])
          const now = watch()
          for (const r of [...now.geos, ...now.mats]) seen.add(r)
        }
    applyOutfit(rig, 'hoodie')
    applyHair(rig, 'wavy-fringe', DEFAULT_LOOK.base.hairColor)
    const after = watch()
    // same amount alive as at the start, and everything no longer in the scene graph was freed
    expect(after.geos.size).toBe(before.geos.size)
    expect(after.mats.size).toBe(before.mats.size)
    const label = (r: object) => `${(r as { type: string }).type}`
    for (const r of seen)
      if (!after.geos.has(r as BufferGeometry) && !after.mats.has(r as Material)) expect(disposed.has(r), `replaced ${label(r)}`).toBe(true)
    // and the rig's own dispose frees the rest
    rig.dispose()
    for (const r of [...after.geos, ...after.mats]) expect(disposed.has(r), `alive ${label(r)}`).toBe(true)
  })
})

describe('facial features carry paper rims (ruling R14)', () => {
  /** The features R14 names: eyes, brows, mouth and glasses (lenses + bridge). Nose line, moustache and
   * the glasses' temples are ink only: their rims merged into a pale muzzle and white bars by the ears. */
  const RIMMED = new Set(['eye', 'brow', 'mouth', 'lens', 'bridge'])
  const features = (rig: Rig) => {
    const out: Mesh[] = []
    rig.face.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh && RIMMED.has(m.name)) out.push(m)
    })
    return out
  }
  const ownBox = (m: Mesh) => {
    m.geometry.computeBoundingBox()
    return m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld)
  }

  it('every ink feature has a white rim behind it, at least RIM wider on every side, drawn before the ink', () => {
    const rig = buildCharacter(lookOf('wavy-fringe', 'hoodie', { glasses: true, skin: '#6e4630' }))
    rig.root.updateMatrixWorld(true)
    const list = features(rig)
    // 2 brows, 2 smile arcs, 2 open-eye dots, 2 mouths + glasses: 2 lenses, bridge
    expect(list).toHaveLength(11)
    expect(new Set(list.map((m) => m.name))).toEqual(RIMMED)
    for (const ink of list) {
      const rim = ink.children.find((c) => c.name === RIM_NAME) as Mesh
      expect(rim, ink.uuid).toBeTruthy()
      const mat = rim.material as MeshBasicMaterial
      expect(mat.color.getHexString()).toBe('ffffff')
      expect(mat.depthWrite).toBe(false)
      expect(rim.renderOrder).toBeLessThan(ink.renderOrder)
      const a = ownBox(ink)
      const b = ownBox(rim)
      // in face space the margin is ≥ RIM before rotation; allow the features' small turns (≤ 0.35 rad)
      const m = RIM * Math.cos(0.36) - 1e-6
      expect(a.min.x - b.min.x).toBeGreaterThanOrEqual(m * 0.8)
      expect(b.max.x - a.max.x).toBeGreaterThanOrEqual(m * 0.8)
      expect(a.min.y - b.min.y).toBeGreaterThanOrEqual(m * 0.8)
      expect(b.max.y - a.max.y).toBeGreaterThanOrEqual(m * 0.8)
      // lifted toward the camera, so the skin around the feature never hides it
      expect(b.getCenter(new Vector3()).z).toBeGreaterThan(a.getCenter(new Vector3()).z)
    }
  })

  it('every unlit ink mark on the face draws after the rims', () => {
    const rig = buildCharacter(lookOf('wavy-fringe', 'hoodie', { glasses: true }))
    rig.face.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh && (m.material as MeshBasicMaterial).isMeshBasicMaterial && m.name !== RIM_NAME) expect(m.renderOrder, m.name).toBe(2)
    })
  })

  it('rims follow their feature: hidden open eyes and open mouth hide their rims too', () => {
    const rig = buildCharacter(DEFAULT_LOOK)
    expect(rig.eyes.open.visible).toBe(false)
    expect(rig.mouth.open.visible).toBe(false)
    expect(rig.mouth.open.children.some((c) => c.name === RIM_NAME)).toBe(true)
  })
})
