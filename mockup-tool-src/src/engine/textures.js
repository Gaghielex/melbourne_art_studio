import { gaussianBlurAlpha } from './blur.js'

const frameSrc = (file) => `${import.meta.env.BASE_URL}textures/frames/${file}`

// v2 PRD §3.9 — all real photographed frame materials. Oak/walnut/black
// replace the small v1 bitmaps; the rest are new. Gold leaf is deferred
// until a real texture is sourced.
export const TEXTURE_OPTIONS = [
  { key: 'oak', label: 'Oak', short: 'oak', src: frameSrc('oak.jpg') },
  { key: 'walnut', label: 'Walnut', short: 'walnut', src: frameSrc('walnut.jpg') },
  { key: 'black', label: 'Black open-grain', short: 'black open-grain', src: frameSrc('black.jpg') },
  { key: 'limed-oak', label: 'Limed oak', short: 'limed oak', src: frameSrc('limed-oak.jpg') },
  { key: 'ash', label: 'Light ash', short: 'light ash', src: frameSrc('ash.jpg') },
  { key: 'cherry', label: 'Cherry', short: 'cherry', src: frameSrc('cherry.jpg') },
]

const textureCanvases = Object.fromEntries(TEXTURE_OPTIONS.map((o) => [o.key, null]))
const textureCanvasesRotated = Object.fromEntries(TEXTURE_OPTIONS.map((o) => [o.key, null]))
const textureCanvasesLight = Object.fromEntries(TEXTURE_OPTIONS.map((o) => [o.key, null]))
const textureCanvasesLightRotated = Object.fromEntries(TEXTURE_OPTIONS.map((o) => [o.key, null]))
let texturesReady = false
let loadPromise = null

// v2 PRD §3.12 — paper tooth from the same photographed sheet as the
// deckled edge (deckle-edge.png). Interior is cropped in code so the torn
// lip never tiles into the margin.
let paperGrainCanvas = null
let paperToothCanvas = null
let canvasWeaveCanvas = null
let canvasLinenCanvas = null
let woodPanelCanvas = null
const deckleSheetSrc = `${import.meta.env.BASE_URL}textures/surfaces/deckle-edge.png`
const canvasWeaveSrc = `${import.meta.env.BASE_URL}textures/surfaces/canvas.jpg`
const woodPanelSrc = `${import.meta.env.BASE_URL}textures/walls/wood-panel.jpg`

export const ART_TEXTURE_OPTIONS = [
  { key: 'none', label: 'None' },
  { key: 'paper', label: 'Paper' },
  { key: 'canvas', label: 'Canvas' },
  { key: 'wood-panel', label: 'Wood panel' },
]

// Real alpha-channel crops taken from each torn edge of deckle-edge.png (not
// a smoothed profile derived from it) — used as an actual stamped mask along
// the artwork's own border, so its edge shows the source photo's real
// fibrous, brushstroke-like irregularity rather than a smooth wavy line.
const edgeMaskCanvases = { top: null, bottom: null, left: null, right: null }
const edgeMaskSrc = {
  top: `${import.meta.env.BASE_URL}textures/surfaces/edge-top.png`,
  bottom: `${import.meta.env.BASE_URL}textures/surfaces/edge-bottom.png`,
  left: `${import.meta.env.BASE_URL}textures/surfaces/edge-left.png`,
  right: `${import.meta.env.BASE_URL}textures/surfaces/edge-right.png`,
}

function canvasFromGray(w, h, fill) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const imgData = ctx.createImageData(w, h)
  const d = imgData.data
  for (let i = 0, p = 0; i < fill.length; i++, p += 4) {
    const v = fill[i]
    d[p] = d[p + 1] = d[p + 2] = v
    d[p + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)
  return c
}

function normalizeWoodMaps(img) {
  // One long grain strip per moulding. A high-pass (blur-and-subtract) keeps
  // the fine linear grain and drops the large cathedral-figure lobes — those
  // read as a camo speckle on white when overlay only shows the extremes.
  const targetW = 512
  const targetH = 1536
  const src = document.createElement('canvas')
  src.width = targetW
  src.height = targetH
  const sctx = src.getContext('2d')
  sctx.imageSmoothingEnabled = true
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(img, 0, 0, targetW, targetH)
  const data = sctx.getImageData(0, 0, targetW, targetH).data
  const n = targetW * targetH
  const gray = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    gray[i] = 0.3 * data[p] + 0.59 * data[p + 1] + 0.11 * data[p + 2]
  }
  const blurred = new Float32Array(gray)
  gaussianBlurAlpha(blurred, targetW, targetH, 8)
  const overlay = new Uint8ClampedArray(n)
  const multiply = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    const hp = gray[i] - blurred[i]
    const t = Math.tanh(hp / 10)
    // High-pass only. The photographed cathedral figure becomes cloudy
    // blotches on dark paint; fine linear grain is what used to read.
    overlay[i] = Math.max(0, Math.min(255, 128 + t * 108))
    // White is neutral for multiply; only the dark veins remain.
    multiply[i] = Math.max(0, Math.min(255, 255 + Math.min(0, t) * 96))
  }
  return {
    overlay: canvasFromGray(targetW, targetH, overlay),
    multiply: canvasFromGray(targetW, targetH, multiply),
  }
}

function extractPaperInterior(img) {
  const src = document.createElement('canvas')
  src.width = img.width
  src.height = img.height
  const sctx = src.getContext('2d')
  sctx.drawImage(img, 0, 0)
  const { data, width: w, height: h } = sctx.getImageData(0, 0, src.width, src.height)
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 40) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX <= minX || maxY <= minY) {
    minX = Math.round(w * 0.15)
    minY = Math.round(h * 0.15)
    maxX = w - minX
    maxY = h - minY
  }
  const insetX = Math.round((maxX - minX) * 0.14)
  const insetY = Math.round((maxY - minY) * 0.14)
  const sx = minX + insetX
  const sy = minY + insetY
  const cw = Math.max(32, maxX - minX - insetX * 2)
  const ch = Math.max(32, maxY - minY - insetY * 2)
  const out = document.createElement('canvas')
  out.width = cw
  out.height = ch
  out.getContext('2d').drawImage(src, sx, sy, cw, ch, 0, 0, cw, ch)
  return out
}

// Keep the photographed tooth and colour, but flatten the sheet's lighting
// so it reads as even ivory card — the high-pass/multiply path turned the
// same photo into dark pits.
function normalizePaperGrain(srcCanvas) {
  const w = srcCanvas.width
  const h = srcCanvas.height
  const ctx = srcCanvas.getContext('2d')
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const n = w * h
  let sr = 0
  let sg = 0
  let sb = 0
  for (let i = 0; i < d.length; i += 4) {
    sr += d[i]
    sg += d[i + 1]
    sb += d[i + 2]
  }
  const mr = sr / n
  const mg = sg / n
  const mb = sb / n
  const tr = 247
  const tg = 244
  const tb = 238
  const amp = 0.62
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.max(0, Math.min(255, tr + (d[i] - mr) * amp))
    d[i + 1] = Math.max(0, Math.min(255, tg + (d[i + 1] - mg) * amp))
    d[i + 2] = Math.max(0, Math.min(255, tb + (d[i + 2] - mb) * amp))
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return srcCanvas
}

// Fine signed tooth around mid-grey — strong enough to read on the
// artwork, without the dark-pit multiply that made the sheet look dirty.
function makePaperTooth(srcCanvas) {
  const w = srcCanvas.width
  const h = srcCanvas.height
  const data = srcCanvas.getContext('2d').getImageData(0, 0, w, h).data
  const n = w * h
  const gray = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    gray[i] = 0.3 * data[p] + 0.59 * data[p + 1] + 0.11 * data[p + 2]
  }
  const blurred = new Float32Array(gray)
  gaussianBlurAlpha(blurred, w, h, Math.max(4, Math.round(Math.min(w, h) * 0.012)))
  const tooth = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    tooth[i] = Math.max(0, Math.min(255, 128 + Math.max(-26, Math.min(26, (gray[i] - blurred[i]) * 2.8))))
  }
  return canvasFromGray(w, h, tooth)
}

function imageToCanvas(img) {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth || img.width
  c.height = img.naturalHeight || img.height
  c.getContext('2d').drawImage(img, 0, 0)
  return c
}

// Mid-grey high-pass so a photographed surface can overlay ink without
// painting its own colour as a slab over the print.
function makeHighPassMap(srcCanvas, blurRadius, amp, clip) {
  const w = srcCanvas.width
  const h = srcCanvas.height
  const data = srcCanvas.getContext('2d').getImageData(0, 0, w, h).data
  const n = w * h
  const gray = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    gray[i] = 0.3 * data[p] + 0.59 * data[p + 1] + 0.11 * data[p + 2]
  }
  const blurred = new Float32Array(gray)
  gaussianBlurAlpha(blurred, w, h, blurRadius)
  const tooth = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    tooth[i] = Math.max(0, Math.min(255, 128 + Math.max(-clip, Math.min(clip, (gray[i] - blurred[i]) * amp))))
  }
  return canvasFromGray(w, h, tooth)
}

function makeCanvasWeave(srcCanvas) {
  return makeHighPassMap(srcCanvas, 3, 3.6, 36)
}

function canvasToMax(img, maxEdge) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const scale = Math.min(1, maxEdge / Math.max(iw, ih))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(iw * scale))
  c.height = Math.max(1, Math.round(ih * scale))
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c
}

function rotate90(canvas) {
  const c = document.createElement('canvas')
  c.width = canvas.height
  c.height = canvas.width
  const ctx = c.getContext('2d')
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  return c
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function loadTextures() {
  if (loadPromise) return loadPromise
  loadPromise = Promise.all([
    ...TEXTURE_OPTIONS.filter((o) => o.src).map(async (o) => {
      const img = await loadImage(o.src)
      const maps = normalizeWoodMaps(img)
      textureCanvases[o.key] = maps.overlay
      textureCanvasesRotated[o.key] = rotate90(maps.overlay)
      textureCanvasesLight[o.key] = maps.multiply
      textureCanvasesLightRotated[o.key] = rotate90(maps.multiply)
    }),
    loadImage(deckleSheetSrc).then((img) => {
      const interior = extractPaperInterior(img)
      paperToothCanvas = makePaperTooth(interior)
      paperGrainCanvas = normalizePaperGrain(interior)
    }),
    ...Object.entries(edgeMaskSrc).map(([key, src]) =>
      loadImage(src).then((img) => {
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        c.getContext('2d').drawImage(img, 0, 0)
        edgeMaskCanvases[key] = c
      }),
    ),
    loadImage(canvasWeaveSrc).then((img) => {
      canvasLinenCanvas = imageToCanvas(img)
      canvasWeaveCanvas = makeCanvasWeave(canvasLinenCanvas)
    }),
  ]).then(() => {
    texturesReady = true
    return true
  })
  return loadPromise
}

export function getTextures() {
  return {
    textureCanvases,
    textureCanvasesRotated,
    textureCanvasesLight,
    textureCanvasesLightRotated,
    texturesReady,
    paperGrainCanvas,
    paperToothCanvas,
    canvasWeaveCanvas,
    canvasLinenCanvas,
    woodPanelCanvas,
    edgeMaskCanvases,
  }
}

loadTextures()

let woodPanelPromise = null

export function loadArtSurfaceTexture(key) {
  if (!key || key === 'none') return Promise.resolve(null)
  if (key === 'wood-panel') {
    if (woodPanelCanvas) return Promise.resolve(woodPanelCanvas)
    if (woodPanelPromise) return woodPanelPromise
    woodPanelPromise = loadImage(woodPanelSrc).then((img) => {
      woodPanelCanvas = makeHighPassMap(canvasToMax(img, 1536), 6, 2.8, 32)
      return woodPanelCanvas
    })
    return woodPanelPromise
  }
  return loadTextures()
}

// v2 PRD §3.6 — wall texture options for the "Wall" background mode. Unlike
// frame textures (small, eagerly preloaded above), these are 1-6MB each, so
// they lazy-load only once actually selected rather than all up front.
export const WALL_TEXTURE_OPTIONS = [
  { key: 'plaster', label: 'Plaster', src: `${import.meta.env.BASE_URL}textures/walls/plaster.jpg` },
  { key: 'concrete', label: 'Concrete', src: `${import.meta.env.BASE_URL}textures/walls/concrete.jpg` },
  { key: 'plaster-dark', label: 'Dark plaster', src: `${import.meta.env.BASE_URL}textures/walls/plaster-dark.jpg` },
]

const wallTextureCache = {}
const wallTextureLoadPromises = {}

// Resolves once the given wall texture key is loaded (kicking off the load
// the first time it's requested). Safe to call repeatedly — cached after
// the first load.
export function loadWallTexture(key) {
  if (wallTextureCache[key]) return Promise.resolve(wallTextureCache[key])
  if (wallTextureLoadPromises[key]) return wallTextureLoadPromises[key]
  const opt = WALL_TEXTURE_OPTIONS.find((o) => o.key === key)
  if (!opt) return Promise.resolve(null)
  wallTextureLoadPromises[key] = loadImage(opt.src).then((img) => {
    wallTextureCache[key] = img
    return img
  })
  return wallTextureLoadPromises[key]
}

// Synchronous lookup for the render path — null until loadWallTexture(key)
// has actually resolved once.
export function getCachedWallTexture(key) {
  return wallTextureCache[key] || null
}

export function drawContinuousOverlay(ctx, pts, textureCanvas, alpha, mode = 'overlay', scale = 0.7) {
  if (!textureCanvas) return
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.clip()
  ctx.globalCompositeOperation = mode
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // Crop a slice of the strip instead of squashing all 512px of figure into
  // a ~20px moulding — that crush is what turned cathedral grain into camo
  // speckles. Grain still runs the length of the side without tiling.
  // `scale` is dest-across / slice-across: <1 magnifies (light frames),
  // >1 packs finer lines (dark frames, closer to the old noticeable grain).
  const destW = maxX - minX
  const destH = maxY - minY
  const texW = textureCanvas.width
  const texH = textureCanvas.height
  const destAcross = Math.min(destW, destH)
  const texAcross = Math.min(texW, texH)
  const sliceAcross = Math.max(8, Math.min(texAcross, Math.round(destAcross * scale)))
  const seed = Math.abs(Math.round(minX * 13 + minY * 7))
  if (texW >= texH) {
    const sy = seed % Math.max(1, texH - sliceAcross)
    ctx.drawImage(textureCanvas, 0, sy, texW, sliceAcross, minX, minY, destW, destH)
  } else {
    const sx = seed % Math.max(1, texW - sliceAcross)
    ctx.drawImage(textureCanvas, sx, 0, sliceAcross, texH, minX, minY, destW, destH)
  }
  ctx.restore()
}
