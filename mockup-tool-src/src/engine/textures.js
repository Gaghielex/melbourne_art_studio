export const TEXTURE_OPTIONS = [
  { key: 'none', label: 'Flat (no grain)', short: 'flat', src: null },
  { key: 'oak', label: 'Oak — real grain', short: 'oak', src: `${import.meta.env.BASE_URL}textures/oak.jpg` },
  { key: 'walnut', label: 'Walnut — real grain', short: 'walnut', src: `${import.meta.env.BASE_URL}textures/walnut.jpg` },
  { key: 'black', label: 'Brushed black — real grain', short: 'brushed black', src: `${import.meta.env.BASE_URL}textures/black.jpg` },
]

const textureCanvases = { none: null, oak: null, walnut: null, black: null }
const textureCanvasesRotated = { none: null, oak: null, walnut: null, black: null }
let wallPlasterCanvas = null
let texturesReady = false
let loadPromise = null

function normalizeWoodTexture(img) {
  // Build one long, high-resolution grain strip. It is mapped once along each
  // moulding rather than repeated every few frame-widths, so knots and figure
  // do not reveal a tiled pattern.
  const targetW = 512
  const targetH = 1536
  const c = document.createElement('canvas')
  c.width = targetW
  c.height = targetH
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, targetW, targetH)
  const imgData = ctx.getImageData(0, 0, c.width, c.height)
  const d = imgData.data
  let sum = 0
  let n = 0
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
    sum += gray
    n++
  }
  const mean = sum / n
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
    const v = Math.max(0, Math.min(255, 128 + (gray - mean) * 1.35))
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(imgData, 0, 0)
  return c
}

function makeBrushedTexture() {
  // The source black bitmap is extremely narrow and becomes blocky when
  // enlarged. Generate fine, directional brush marks at useful render
  // resolution instead. Values stay around middle grey because this canvas is
  // blended over the selected frame colour.
  const width = 512
  const height = 1536
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')
  const image = ctx.createImageData(width, height)
  const data = image.data
  let seed = 7283
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const streaks = new Float32Array(width)
  let value = 0
  for (let x = 0; x < width; x++) {
    value = value * 0.82 + (random() - 0.5) * 12
    streaks[x] = value
  }
  for (let y = 0; y < height; y++) {
    const slow = Math.sin(y * 0.021) * 1.5
    for (let x = 0; x < width; x++) {
      const fine = (random() - 0.5) * 3.5
      const v = Math.max(104, Math.min(152, 128 + streaks[x] + slow + fine))
      const i = (y * width + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
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
      textureCanvases[o.key] = o.key === 'black' ? makeBrushedTexture() : normalizeWoodTexture(img)
      textureCanvasesRotated[o.key] = rotate90(textureCanvases[o.key])
    }),
    loadImage(`${import.meta.env.BASE_URL}textures/wall-plaster.jpg`).then((img) => {
      wallPlasterCanvas = img
    }),
  ]).then(() => {
    texturesReady = true
    return true
  })
  return loadPromise
}

export function getTextures() {
  return { textureCanvases, textureCanvasesRotated, texturesReady, wallPlasterCanvas }
}

export function drawContinuousOverlay(ctx, pts, textureCanvas, alpha) {
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
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // A single strip spans the entire mitred side. The polygon clip preserves
  // the 45° joint while the grain remains continuous from end to end.
  ctx.drawImage(textureCanvas, minX, minY, maxX - minX, maxY - minY)
  ctx.restore()
}
