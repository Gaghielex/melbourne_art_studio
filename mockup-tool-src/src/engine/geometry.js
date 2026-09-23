export function solveLinearSystem(A, b) {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    }
    ;[M[col], M[pivot]] = [M[pivot], M[col]]
    const pv = M[col][col]
    if (Math.abs(pv) < 1e-12) continue
    for (let c = col; c <= n; c++) M[col][c] /= pv
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = M[r][col]
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c]
    }
  }
  return M.map((row) => row[n])
}

export function computeHomography(src, dst) {
  const A = []
  const b = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v])
    b.push(v)
  }
  const h = solveLinearSystem(A, b)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

export function invert3x3(m) {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const D = -(b * i - c * h)
  const E = a * i - c * g
  const F = -(a * h - b * g)
  const G = b * f - c * e
  const H = -(a * f - c * d)
  const I = a * e - b * d
  const det = a * A + b * B + c * C
  return [A / det, D / det, G / det, B / det, E / det, H / det, C / det, F / det, I / det]
}

export function applyH(m, x, y) {
  const w = m[6] * x + m[7] * y + m[8]
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w }
}

export function warpToRect(srcCanvas, corners, outW, outH) {
  outW = Math.round(outW)
  outH = Math.round(outH)
  const sctx = srcCanvas.getContext('2d')
  const sw = srcCanvas.width
  const sh = srcCanvas.height
  const srcData = sctx.getImageData(0, 0, sw, sh).data

  const dst = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ]
  const H = computeHomography(corners, dst)
  const Hinv = invert3x3(H)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = outW
  outCanvas.height = outH
  const octx = outCanvas.getContext('2d', { willReadFrequently: true })
  const outImg = octx.createImageData(outW, outH)
  const outData = outImg.data

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const p = applyH(Hinv, x + 0.5, y + 0.5)
      const sx = p.x
      const sy = p.y
      const di = (y * outW + x) * 4
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
        outData[di] = 250
        outData[di + 1] = 248
        outData[di + 2] = 244
        outData[di + 3] = 255
        continue
      }
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const fx = sx - x0
      const fy = sy - y0
      for (let c = 0; c < 3; c++) {
        const i00 = (y0 * sw + x0) * 4 + c
        const i10 = (y0 * sw + x0 + 1) * 4 + c
        const i01 = ((y0 + 1) * sw + x0) * 4 + c
        const i11 = ((y0 + 1) * sw + x0 + 1) * 4 + c
        const top = srcData[i00] * (1 - fx) + srcData[i10] * fx
        const bot = srcData[i01] * (1 - fx) + srcData[i11] * fx
        outData[di + c] = top * (1 - fy) + bot * fy
      }
      outData[di + 3] = 255
    }
  }
  octx.putImageData(outImg, 0, 0)
  return outCanvas
}

export function defaultCorners(dw, dh, inset = 0.08) {
  return [
    { x: dw * inset, y: dh * inset },
    { x: dw * (1 - inset), y: dh * inset },
    { x: dw * (1 - inset), y: dh * (1 - inset) },
    { x: dw * inset, y: dh * (1 - inset) },
  ]
}

export function rectifyPiece(natCanvas, displayCorners, scale) {
  const natCorners = displayCorners.map((c) => ({ x: c.x / scale, y: c.y / scale }))
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const topW = distance(natCorners[0], natCorners[1])
  const botW = distance(natCorners[3], natCorners[2])
  const leftH = distance(natCorners[0], natCorners[3])
  const rightH = distance(natCorners[1], natCorners[2])
  const aspect = (topW + botW) / 2 / ((leftH + rightH) / 2)
  const maxDim = 1100
  let outW
  let outH
  if (aspect >= 1) {
    outW = maxDim
    outH = Math.round(maxDim / aspect)
  } else {
    outH = maxDim
    outW = Math.round(maxDim * aspect)
  }
  return warpToRect(natCanvas, natCorners, outW, outH)
}
