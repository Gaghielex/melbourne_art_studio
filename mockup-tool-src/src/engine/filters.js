import { clamp255, gaussianBlurRGB } from './blur.js'

export const FILTER_KEYS = ['fade', 'contrast', 'warmth', 'grain', 'vignette', 'sharpen']

export const DEFAULT_FILTERS = {
  fade: 0,
  contrast: 0,
  warmth: 0,
  grain: 0,
  vignette: 0,
  sharpen: 0,
}

export const FILTER_PRESETS = [
  { key: 'none', label: 'None', values: { ...DEFAULT_FILTERS } },
  { key: 'gallery', label: 'Gallery', values: { fade: 0, contrast: 14, warmth: 4, grain: 10, vignette: 16, sharpen: 22 } },
  { key: 'moody', label: 'Moody', values: { fade: 10, contrast: 28, warmth: 16, grain: 20, vignette: 48, sharpen: 8 } },
  { key: 'film', label: 'Film', values: { fade: 20, contrast: 10, warmth: 32, grain: 42, vignette: 26, sharpen: 4 } },
]

export const FILTER_SLIDERS = [
  { key: 'fade', label: 'Fade' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'warmth', label: 'Warmth' },
  { key: 'grain', label: 'Grain' },
  { key: 'vignette', label: 'Vignette' },
  { key: 'sharpen', label: 'Sharpen' },
]

export function normalizeFilters(filters) {
  const out = { ...DEFAULT_FILTERS }
  if (!filters) return out
  for (const key of FILTER_KEYS) {
    const n = Number(filters[key])
    out[key] = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
  }
  return out
}

export function filtersMatch(a, b) {
  const left = normalizeFilters(a)
  const right = normalizeFilters(b)
  return FILTER_KEYS.every((key) => left[key] === right[key])
}

export function filtersActive(filters) {
  const f = normalizeFilters(filters)
  return FILTER_KEYS.some((key) => f[key] > 0)
}

function hash2(x, y) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

const GRAIN_TILE = 256
let grainTile = null

function getGrainTile() {
  if (grainTile) return grainTile
  const tile = document.createElement('canvas')
  tile.width = GRAIN_TILE
  tile.height = GRAIN_TILE
  const ctx = tile.getContext('2d')
  const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE)
  const data = img.data
  for (let y = 0, i = 0; y < GRAIN_TILE; y++) {
    for (let x = 0; x < GRAIN_TILE; x++, i += 4) {
      const n = 128 + (hash2(x, y) * 2 - 1) * 120
      data[i] = n
      data[i + 1] = n
      data[i + 2] = n
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  grainTile = tile
  return tile
}

function drawGrainOverlay(ctx, w, h, grainT, scale) {
  const tile = getGrainTile()
  const cell = Math.max(1, scale * 1.2)
  const dw = GRAIN_TILE * cell
  ctx.save()
  ctx.globalAlpha = grainT * 0.32
  ctx.globalCompositeOperation = 'overlay'
  ctx.imageSmoothingEnabled = cell > 1.4
  for (let y = 0; y < h; y += dw) {
    for (let x = 0; x < w; x += dw) {
      ctx.drawImage(tile, x, y, dw, dw)
    }
  }
  ctx.restore()
}

function drawVignetteOverlay(ctx, w, h, vignetteT) {
  const cx = w * 0.5
  const cy = h * 0.5
  const inner = Math.min(w, h) * 0.22
  const outer = Math.hypot(cx, cy) * 1.02
  const grd = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer)
  grd.addColorStop(0, 'rgba(0,0,0,0)')
  grd.addColorStop(0.42, 'rgba(0,0,0,0)')
  grd.addColorStop(1, `rgba(0,0,0,${vignetteT * 0.58})`)
  ctx.save()
  ctx.fillStyle = grd
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

// 3x3 unsharp — cheap enough for live preview; radius-1 gaussian look.
function unsharp3x3(data, w, h, amount) {
  const src = new Uint8ClampedArray(data)
  const lastX = w - 1
  const lastY = h - 1
  for (let y = 0; y < h; y++) {
    const y0 = y === 0 ? 0 : y - 1
    const y2 = y === lastY ? lastY : y + 1
    const row0 = y0 * w
    const row = y * w
    const row2 = y2 * w
    for (let x = 0; x < w; x++) {
      const x0 = x === 0 ? 0 : x - 1
      const x2 = x === lastX ? lastX : x + 1
      const i = (row + x) * 4
      for (let c = 0; c < 3; c++) {
        const blur =
          (src[(row0 + x0) * 4 + c] +
            src[(row0 + x) * 4 + c] * 2 +
            src[(row0 + x2) * 4 + c] +
            src[(row + x0) * 4 + c] * 2 +
            src[i + c] * 4 +
            src[(row + x2) * 4 + c] * 2 +
            src[(row2 + x0) * 4 + c] +
            src[(row2 + x) * 4 + c] * 2 +
            src[(row2 + x2) * 4 + c]) /
          16
        data[i + c] = clamp255(src[i + c] + amount * (src[i + c] - blur))
      }
    }
  }
}

// Photo adjustments applied last to the finished composite. `scale` is
// targetH / BASE_TARGET_H so grain size stays the same relative size in
// preview and export (v2 PRD §3.10). `quality: 'preview'` uses a cheap
// 3x3 sharpen so sliders stay interactive; export keeps the scaled blur.
export function applyCompositeFilters(canvas, filters, scale = 1, quality = 'export') {
  const f = normalizeFilters(filters)
  if (!filtersActive(f) || !canvas) return canvas

  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  if (!w || !h) return canvas

  const s = Math.max(0.25, scale)
  const fadeT = f.fade / 100
  const contrastT = f.contrast / 100
  const warmthT = f.warmth / 100
  const grainT = f.grain / 100
  const vignetteT = f.vignette / 100
  const sharpenT = f.sharpen / 100
  const preview = quality === 'preview'

  if (fadeT || contrastT || warmthT || sharpenT) {
    const img = ctx.getImageData(0, 0, w, h)
    const data = img.data

    if (fadeT || contrastT || warmthT) {
      const contrastAmt = 1 + contrastT * 0.72
      const fadeFloor = fadeT * 42
      const fadeKeep = 1 - fadeFloor / 255
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i]
        let g = data[i + 1]
        let b = data[i + 2]
        if (contrastT) {
          r = (r - 128) * contrastAmt + 128
          g = (g - 128) * contrastAmt + 128
          b = (b - 128) * contrastAmt + 128
        }
        if (fadeT) {
          r = fadeFloor + r * fadeKeep
          g = fadeFloor + g * fadeKeep
          b = fadeFloor + b * fadeKeep
        }
        if (warmthT) {
          r += warmthT * 22
          g += warmthT * 5
          b -= warmthT * 20
        }
        data[i] = clamp255(r)
        data[i + 1] = clamp255(g)
        data[i + 2] = clamp255(b)
      }
    }

    if (sharpenT) {
      const amt = sharpenT * 0.88
      if (preview) {
        unsharp3x3(data, w, h, amt)
      } else {
        const radius = Math.max(1, Math.round(1.15 * s))
        const blur = new ImageData(new Uint8ClampedArray(data), w, h)
        gaussianBlurRGB(blur.data, w, h, radius)
        const src = blur.data
        for (let i = 0; i < data.length; i += 4) {
          data[i] = clamp255(data[i] + amt * (data[i] - src[i]))
          data[i + 1] = clamp255(data[i + 1] + amt * (data[i + 1] - src[i + 1]))
          data[i + 2] = clamp255(data[i + 2] + amt * (data[i + 2] - src[i + 2]))
        }
      }
    }

    ctx.putImageData(img, 0, 0)
  }

  if (vignetteT) drawVignetteOverlay(ctx, w, h, vignetteT)
  if (grainT) drawGrainOverlay(ctx, w, h, grainT, s)
  return canvas
}
