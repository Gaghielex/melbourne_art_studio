export function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function boxBlurChannel(src, dst, w, h, radius, horizontal) {
  const r = Math.max(1, radius | 0)
  const norm = 1 / (2 * r + 1)
  if (horizontal) {
    for (let y = 0; y < h; y++) {
      const rowOff = y * w
      let sum = 0
      for (let x = -r; x <= r; x++) {
        const xx = x < 0 ? 0 : x >= w ? w - 1 : x
        sum += src[rowOff + xx]
      }
      for (let x = 0; x < w; x++) {
        dst[rowOff + x] = sum * norm
        const addX = Math.min(w - 1, x + r + 1)
        const subX = Math.max(0, x - r)
        sum += src[rowOff + addX] - src[rowOff + subX]
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let y = -r; y <= r; y++) {
        const yy = y < 0 ? 0 : y >= h ? h - 1 : y
        sum += src[yy * w + x]
      }
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = sum * norm
        const addY = Math.min(h - 1, y + r + 1)
        const subY = Math.max(0, y - r)
        sum += src[addY * w + x] - src[subY * w + x]
      }
    }
  }
}

export function gaussianBlurAlpha(alphaArr, w, h, radius) {
  let a = alphaArr
  const b = new Float32Array(w * h)
  for (let pass = 0; pass < 3; pass++) {
    boxBlurChannel(a, b, w, h, radius, true)
    boxBlurChannel(b, a, w, h, radius, false)
  }
  return a
}

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// `feather` is how far the silhouette is softened and is deliberately separate
// from `radius`: the corner rounding can grow with the moulding while the
// straight edges stay crisp, which tying the two together would not allow.
export function applyFeatheredCorners(canvas, radius, feather = Math.max(1, radius * 0.4)) {
  const w = canvas.width
  const h = canvas.height
  const mask = document.createElement('canvas')
  mask.width = w
  mask.height = h
  const mctx = mask.getContext('2d', { willReadFrequently: true })
  mctx.fillStyle = '#fff'
  roundRectPath(mctx, 0, 0, w, h, radius)
  mctx.fill()

  if (feather > 0) {
    const imgData = mctx.getImageData(0, 0, w, h)
    const data = imgData.data
    const alphaArr = new Float32Array(w * h)
    for (let i = 0, p = 3; i < w * h; i++, p += 4) alphaArr[i] = data[p]
    const blurred = gaussianBlurAlpha(alphaArr, w, h, feather)
    for (let i = 0, p = 3; i < w * h; i++, p += 4) data[p] = clamp255(blurred[i])
    mctx.putImageData(imgData, 0, 0)
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0)
  ctx.restore()
}
