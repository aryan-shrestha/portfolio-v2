import {
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Mesh,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import type { Camera, WebGLRenderer } from 'three'

const hexVec = (h: string) => new Vector3(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)

export type DitherOpts = {
  /** CSS px per dot */
  px: number
  /** Circular clip in CSS px from the window centre (y up). */
  clip?: { cx: number; cy: number; r: number }
  /** 0–1: how much of him is left (vanish). Dots drop out in 2×2-cell ordered-dither steps. Default 1. */
  fade?: number
  /** 0–1: camera flash. Washes him out and lays white over the window. Default 0. */
  flash?: number
}

/**
 * Two-pass ordered dither. The scene renders into an RGBA nearest-filtered target at W/px x H/px
 * (alpha: background 0, normal 1, accent 0.5); the post pass turns it into ink/white or vermilion/white dots.
 * The renderer must have an alpha-capable canvas and pixel ratio 1.
 */
export function createDitherPass(renderer: WebGLRenderer) {
  const rt = new WebGLRenderTarget(2, 2, { minFilter: NearestFilter, magFilter: NearestFilter })
  const post = new ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture },
      ink: { value: hexVec('#111110') },
      accent: { value: hexVec('#e2462c') },
      paper: { value: hexVec('#ffffff') },
      clipC: { value: new Vector2() },
      clipR: { value: 1e6 },
      fade: { value: 1 },
      flash: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 ink; uniform vec3 accent; uniform vec3 paper; uniform vec2 clipC; uniform float clipR;
    uniform float fade; uniform float flash; varying vec2 vUv;
    float bayer4(vec2 p){ int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
      float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[x + y * 4] + 0.5) / 16.0; }
    void main(){
      if (distance(gl_FragCoord.xy, clipC) > clipR) discard;
      vec4 c = texture2D(tDiffuse, vUv);
      // background: transparent, or premultiplied white while the flash is up
      if (c.a < 0.25) { if (flash <= 0.0) discard; gl_FragColor = vec4(flash); return; }
      // vanish: a coarser ordered pattern than the shading, so he dissolves in blocks, not into ink
      if (bayer4(floor(gl_FragCoord.xy / 2.0)) >= fade) discard;
      float l = clamp((pow(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)), 1.0 / 2.2) - 0.03) * 1.35 + flash, 0.0, 1.0);
      bool rope = c.a < 0.75;
      float th = bayer4(gl_FragCoord.xy);
      vec3 a = rope ? accent : ink; float lv = rope ? clamp(l * 0.75 - 0.12, 0.0, 1.0) : l;
      gl_FragColor = vec4(lv > th ? paper : a, 1.0);
    }`,
  })
  const quad = new Mesh(new PlaneGeometry(2, 2), post)
  quad.frustumCulled = false
  const postScene = new Scene()
  postScene.add(quad)
  const postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  renderer.setClearColor(0x000000, 0)
  let curPx = 3
  let W = 2
  let H = 2

  return {
    render(scene: Scene, camera: Camera, opts: DitherOpts) {
      curPx = opts.px
      const { clip } = opts
      post.uniforms.clipR.value = clip ? clip.r / curPx : 1e6
      post.uniforms.clipC.value.set(clip ? (W / 2 + clip.cx) / curPx : 0, clip ? (H / 2 + clip.cy) / curPx : 0)
      post.uniforms.fade.value = opts.fade ?? 1
      post.uniforms.flash.value = opts.flash ?? 0
      renderer.setRenderTarget(rt)
      renderer.clear()
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      renderer.clear()
      renderer.render(postScene, postCam)
    },
    resize(w: number, h: number, px: number) {
      W = w
      H = h
      curPx = px
      const rw = Math.max(2, Math.ceil(w / px))
      const rh = Math.max(2, Math.ceil(h / px))
      renderer.setPixelRatio(1)
      renderer.setSize(rw, rh, false)
      rt.setSize(rw, rh)
    },
    dispose() {
      rt.dispose()
      post.dispose()
      quad.geometry.dispose()
    },
  }
}
