import { applyFeatheredCorners, clamp255, gaussianBlurAlpha, roundRectPath } from './blur.js'
import { hexToRgb, hslToRgb, rgbToHsl, shade } from './color.js'
import { drawContinuousOverlay, getTextures } from './textures.js'

function smoothStep(a, b, v) {
  const u = Math.max(0, Math.min(1, (v - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

function buildFrameTexture(frameOuterW, frameOuterH, frameW, seed) {
  const canvas = document.createElement('canvas')
  canvas.width = frameOuterW
  canvas.height = frameOuterH
  const ctx = canvas.getContext('2d')
  const imgData = ctx.createImageData(frameOuterW, frameOuterH)
  const data = imgData.data

  const rgb = { r: 22, g: 19, b: 17 }

  // A single key light in front of the piece, above it and to its left, in
  // screen space: x right, y down, z out of the screen toward the viewer. The
  // azimuth sits near 45° and a little higher than it is lateral, which is what
  // a photographed frame shows — its top and left faces land within a few
  // percent of each other, and its bottom face reads darker than its right.
  const lx = -0.52
  const ly = -0.63
  const lz = 0.5768
  // Blinn half-vector for the specular lobe, with the viewer at (0, 0, 1).
  const hx = lx
  const hy = ly
  const hz = lz + 1
  const hLen = Math.hypot(hx, hy, hz)
  // Everything the surface reflects rather than absorbs, in output levels, kept
  // out of the baked body tone and added during tinting. Surface reflection does
  // not scale with how dark the moulding is painted — that is exactly why a
  // black frame still shows a clearly lit side, a clearly shadowed one, and a
  // bright mitre joint.
  const reflectMap = new Float32Array(frameOuterW * frameOuterH)
  // Width of the arris along the mitre. The proportion is taken from the
  // photograph; the floor keeps the highlight at least a pixel wide on a narrow
  // moulding, where a sub-pixel line would come out stippled.
  const seamSigma = Math.max(0.9, frameW * 0.035)

  for (let y = 0; y < frameOuterH; y++) {
    for (let x = 0; x < frameOuterW; x++) {
      // Nearest horizontal moulding (left or right) and nearest vertical one
      // (top or bottom), each with the direction it faces away from the art.
      const sx = x <= frameOuterW - x ? -1 : 1
      const dH = sx < 0 ? x : frameOuterW - x
      const sy = y <= frameOuterH - y ? -1 : 1
      const dV = sy < 0 ? y : frameOuterH - y

      // Whichever is nearer owns this pixel. Comparing the two distances keeps
      // this unambiguous at any aspect ratio — testing each band's range
      // independently instead lets a pixel match two sides at once and shades
      // one of them wrongly.
      const horizontal = dH <= dV
      const distAcross = horizontal ? dH : dV
      const ax = horizontal ? sx : 0
      const ay = horizontal ? 0 : sy
      const t = Math.max(0, Math.min(1, distAcross / frameW))

      // The two lengths of moulding meet on a 45° mitre, exactly where the two
      // distances are equal. Perpendicular distance from this pixel to that
      // joint, and the in-plane direction across it.
      const seamDist = Math.abs(dH - dV) * Math.SQRT1_2
      const seamFall = Math.exp(-Math.pow(seamDist / seamSigma, 2))

      // The moulding's cross-section, expressed as how far the surface normal
      // tilts within the plane: positive turns the face outward toward the
      // wall, negative turns it inward toward the art. The face is flat and
      // splayed at a constant angle — measured off a photographed moulding,
      // which holds one even tone right across its width rather than rounding
      // off — with a chamfer at the outer edge and the rabbet dropping to the
      // mat at the inner one.
      const nAcross =
        0.28 +
        0.75 * (1 - smoothStep(0, 0.07, t)) -
        1.3 * smoothStep(0.86, 0.99, t)

      // Point that tilt along this side's own outward direction. This is what
      // makes the top and left mouldings catch the key light while the bottom
      // and right sit in shadow, and what flips the ordering again across the
      // rabbet — the cues that read as a solid object rather than a gradient.
      const nx = ax * nAcross
      const ny = ay * nAcross
      const nLen = Math.hypot(nx, ny, 1)
      const diffuse = Math.max(0, (nx * lx + ny * ly + lz) / nLen)
      const spec = Math.pow(
        Math.max(0, (nx * hx + ny * hy + hz) / (nLen * hLen)),
        18,
      )
      // Sawing the mitre leaves a fine rounded arris along the joint, which
      // throws a hard glint when it happens to face the light. Its two facets
      // lie either side of the joint, so take whichever catches more: this is
      // why only the two joints running northeast–southwest light up, while the
      // pair running northwest–southeast stays edge-on to the key and dark.
      let arris = 0
      if (seamFall > 0.002) {
        // In-plane direction across the joint. The sign pairs the two joints
        // that run northeast–southwest against the two that run the other way.
        const seamPx = Math.SQRT1_2
        const seamPy = -sx * sy * Math.SQRT1_2
        let arrisSpec = 0
        let arrisDiff = 0
        for (let s = -1; s <= 1; s += 2) {
          const gx = s * seamPx * 0.9
          const gy = s * seamPy * 0.9
          const gLen = Math.hypot(gx, gy, 1)
          const d = (gx * hx + gy * hy + hz) / (gLen * hLen)
          arrisSpec = Math.max(arrisSpec, Math.pow(Math.max(0, d), 26))
          arrisDiff = Math.max(arrisDiff, Math.max(0, (gx * lx + gy * ly + lz) / gLen))
        }
        // Being rounded rather than knife-edged, the arris never goes fully
        // edge-on, so even the joints facing away from the key stay a little
        // brighter than the faces beside them.
        arris = arrisSpec + 0.07 * arrisDiff
      }

      // The far corner sits fractionally further from the key light.
      const falloff = 1 - 0.035 * ((x / frameOuterW) * 0.6 + (y / frameOuterH) * 0.4)
      // The joint itself sits a touch proud of the faces either side of it.
      const mult = (0.52 + 0.54 * diffuse) * (1 - 0.07 * seamFall) * falloff
      const p = y * frameOuterW + x
      reflectMap[p] = (2.5 * spec + 190 * arris * seamFall) * falloff
      const i = p * 4
      data[i] = clamp255(rgb.r * mult)
      data[i + 1] = clamp255(rgb.g * mult)
      data[i + 2] = clamp255(rgb.b * mult)
      data[i + 3] = 255
    }
  }
  ctx.putImageData(imgData, 0, 0)

  const nW = Math.max(8, Math.round(frameOuterW / 5))
  const nH = Math.max(8, Math.round(frameOuterH / 5))
  const noiseCanvas = document.createElement('canvas')
  noiseCanvas.width = nW
  noiseCanvas.height = nH
  const nctx = noiseCanvas.getContext('2d')
  const nData = nctx.createImageData(nW, nH)
  let rnd = seed || 1
  const rand = () => {
    rnd = (rnd * 9301 + 49297) % 233280
    return rnd / 233280
  }
  for (let i = 0; i < nData.data.length; i += 4) {
    const v = 128 + (rand() - 0.5) * 70
    nData.data[i] = v
    nData.data[i + 1] = v
    nData.data[i + 2] = v
    nData.data[i + 3] = 255
  }
  nctx.putImageData(nData, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.globalAlpha = 0.16
  ctx.globalCompositeOperation = 'overlay'
  ctx.drawImage(noiseCanvas, 0, 0, frameOuterW, frameOuterH)
  ctx.restore()

  return { canvas, reflectMap }
}

function tintFrameTexture(srcCanvas, reflectMap, hex) {
  const w = srcCanvas.width
  const h = srcCanvas.height
  const sctx = srcCanvas.getContext('2d')
  const src = sctx.getImageData(0, 0, w, h)
  const rgb = hexToRgb(hex)
  const [baseH, baseS, baseL] = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const baseChroma = (1 - Math.abs(2 * baseL - 1)) * baseS
  const baseLum = 22 * 0.299 + 19 * 0.587 + 17 * 0.114
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')
  const dst = octx.createImageData(w, h)
  const sd = src.data
  const dd = dst.data
  for (let i = 0; i < sd.length; i += 4) {
    const lum = (sd[i] * 0.299 + sd[i + 1] * 0.587 + sd[i + 2] * 0.114) / Math.max(1, baseLum)
    const mult = Math.max(0.45, Math.min(1.12, lum))
    let newL = baseL * mult
    if (mult > 1) newL = baseL + (1 - baseL) * (mult - 1) * 0.6
    newL = Math.max(0, Math.min(1, newL))
    const chromaDenom = Math.max(0.06, 1 - Math.abs(2 * newL - 1))
    const newS = Math.min(1, baseChroma / chromaDenom)
    const shaded = hslToRgb(baseH, newS, newL)
    const sheen = reflectMap[i >> 2]
    dd[i] = clamp255(shaded.r + sheen)
    dd[i + 1] = clamp255(shaded.g + sheen)
    dd[i + 2] = clamp255(shaded.b + sheen)
    dd[i + 3] = sd[i + 3]
  }
  octx.putImageData(dst, 0, 0)
  return out
}

function drawGlassSheen(ctx, rx, ry, rw, rh, seed) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(rx, ry, rw, rh)
  ctx.clip()
  ctx.globalCompositeOperation = 'screen'

  const diag = Math.sqrt(rw * rw + rh * rh)
  const rnd = (n) => {
    const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
    return v - Math.floor(v)
  }
  const cx = rx + rw * (0.3 + rnd(1) * 0.18)
  const cy = ry + rh * (0.28 + rnd(2) * 0.16)
  const angle = ((-32 + rnd(3) * 14) * Math.PI) / 180

  ctx.translate(cx, cy)
  ctx.rotate(angle)

  const bandWidth = diag * 0.24
  const grad = ctx.createLinearGradient(-bandWidth / 2, 0, bandWidth / 2, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.13)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(-bandWidth / 2, -diag, bandWidth, diag * 2)
  ctx.restore()
}

function drawInsetEdgeShadow(ctx, rx, ry, rw, rh, depth, maxAlpha) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(rx, ry, rw, rh)
  ctx.clip()
  ctx.globalCompositeOperation = 'multiply'

  let g = ctx.createLinearGradient(0, ry, 0, ry + depth)
  g.addColorStop(0, `rgba(0,0,0,${maxAlpha})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(rx, ry, rw, depth)

  g = ctx.createLinearGradient(rx, 0, rx + depth, 0)
  g.addColorStop(0, `rgba(0,0,0,${maxAlpha})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(rx, ry, depth, rh)

  const d2 = depth * 0.65
  const a2 = maxAlpha * 0.55
  g = ctx.createLinearGradient(0, ry + rh, 0, ry + rh - d2)
  g.addColorStop(0, `rgba(0,0,0,${a2})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(rx, ry + rh - d2, rw, d2)

  g = ctx.createLinearGradient(rx + rw, 0, rx + rw - d2, 0)
  g.addColorStop(0, `rgba(0,0,0,${a2})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(rx + rw - d2, ry, d2, rh)

  ctx.restore()
}

function sweptDropPath(ctx, x, y, w, h, ox, oy) {
  // One silhouette: the frame swept down-right. Bottom-left and
  // top-right leave from the real corners. Bottom-right is the
  // frame's own 90° corner, translated — not a chamfer.
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w + ox, y + oy)
  ctx.lineTo(x + w + ox, y + h + oy)
  ctx.lineTo(x + ox, y + h + oy)
  ctx.lineTo(x, y + h)
  ctx.closePath()
}

function drawContactWallShadow(ctx, x, y, w, h, cornerR, wallColor) {
  // One solid, one blur, then punch. The blur is the gradient — a
  // second distance field is what stacked or chamfered the corner.
  const panel = (w + h) / 2
  const ox = panel * 0.04
  const oy = panel * 0.028
  const blurR = Math.max(3, Math.round(panel * 0.012))
  const pad = Math.ceil(blurR * 3 + 8)
  const ow = Math.ceil(w + pad * 2 + ox)
  const oh = Math.ceil(h + pad * 2 + oy)

  const oc = document.createElement('canvas')
  oc.width = ow
  oc.height = oh
  const octx = oc.getContext('2d', { willReadFrequently: true })
  octx.fillStyle = '#000'
  sweptDropPath(octx, pad, pad, w, h, ox, oy)
  octx.fill()

  const data = octx.getImageData(0, 0, ow, oh)
  const alpha = new Float32Array(ow * oh)
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) alpha[i] = data.data[p]
  const blurred = gaussianBlurAlpha(alpha, ow, oh, blurR)
  const rgb = hexToRgb(wallColor)
  const sr = Math.max(0, Math.min(255, Math.round(rgb.r * 0.22 + 10)))
  const sg = Math.max(0, Math.min(255, Math.round(rgb.g * 0.14 + 4)))
  const sb = Math.max(0, Math.min(255, Math.round(rgb.b * 0.09)))
  const out = data.data
  for (let i = 0, p = 0; i < blurred.length; i++, p += 4) {
    out[p] = sr
    out[p + 1] = sg
    out[p + 2] = sb
    const t = blurred[i] / 255
    out[p + 3] = clamp255(Math.pow(t, 1.55) * 255 * 0.82)
  }
  octx.putImageData(data, 0, 0)

  octx.globalCompositeOperation = 'destination-out'
  octx.fillStyle = '#000'
  roundRectPath(octx, pad, pad, w, h, Math.max(2, cornerR))
  octx.fill()

  ctx.drawImage(oc, x - pad, y - pad)
}

function drawFramedPiece(ctx, x, y, artCanvas, frameW, matW, frameColor, matColor, textureKey, wallColor, glaze) {
  const aw = artCanvas.width
  const ah = artCanvas.height
  const matOuterW = aw + matW * 2
  const matOuterH = ah + matW * 2
  const frameOuterW = matOuterW + frameW * 2
  const frameOuterH = matOuterH + frameW * 2
  // The timber's outer arris is only lightly eased. A radius proportional to a
  // quarter of the moulding made the whole corner look out of focus.
  const cornerR = Math.max(0.75, frameW * 0.055)

  drawContactWallShadow(ctx, x, y, frameOuterW, frameOuterH, cornerR, wallColor)

  const frameTex = buildFrameTexture(Math.round(frameOuterW), Math.round(frameOuterH), Math.round(frameW), Math.round(x * 7 + y * 13) + 1)
  const tinted = tintFrameTexture(frameTex.canvas, frameTex.reflectMap, frameColor)

  const { textureCanvases, textureCanvasesRotated, texturesReady } = getTextures()
  if (textureKey !== 'none' && texturesReady) {
    const tctx = tinted.getContext('2d')
    const ow = tinted.width
    const oh = tinted.height
    const fw = frameW
    const topPts = [
      [0, 0],
      [ow, 0],
      [ow - fw, fw],
      [fw, fw],
    ]
    const botPts = [
      [0, oh],
      [ow, oh],
      [ow - fw, oh - fw],
      [fw, oh - fw],
    ]
    const leftPts = [
      [0, 0],
      [0, oh],
      [fw, oh - fw],
      [fw, fw],
    ]
    const rightPts = [
      [ow, 0],
      [ow, oh],
      [ow - fw, oh - fw],
      [ow - fw, fw],
    ]
    const tex = textureCanvases[textureKey]
    const texRot = textureCanvasesRotated[textureKey]
    drawContinuousOverlay(tctx, topPts, texRot, 0.48)
    drawContinuousOverlay(tctx, botPts, texRot, 0.48)
    drawContinuousOverlay(tctx, leftPts, tex, 0.48)
    drawContinuousOverlay(tctx, rightPts, tex, 0.48)
  }

  // The canvas path already anti-aliases the tiny eased corner. Do not blur the
  // silhouette: straight timber edges must remain optically crisp.
  applyFeatheredCorners(tinted, cornerR, 0)
  ctx.drawImage(tinted, x, y)

  // Mat board picks up a slight falloff from the same light direction as the
  // frame. A dead-flat fill is one of the strongest "this is a render" cues,
  // because real paper under room light is never perfectly uniform.
  const matRgb = hexToRgb(matColor)
  const matGrad = ctx.createLinearGradient(x + frameW, y + frameW, x + frameW + matOuterW, y + frameW + matOuterH)
  matGrad.addColorStop(0, shade(matRgb, 0.015))
  matGrad.addColorStop(1, shade(matRgb, -0.055))
  ctx.fillStyle = matGrad
  ctx.fillRect(x + frameW, y + frameW, matOuterW, matOuterH)
  drawInsetEdgeShadow(ctx, x + frameW, y + frameW, matOuterW, matOuterH, matW * 0.4, 0.32)
  ctx.drawImage(artCanvas, x + frameW + matW, y + frameW + matW)
  drawInsetEdgeShadow(ctx, x + frameW + matW, y + frameW + matW, aw, ah, Math.max(6, matW * 0.22), 0.28)
  if (glaze === 'glass') {
    drawGlassSheen(ctx, x + frameW, y + frameW, matOuterW, matOuterH, Math.round(x + y))
  }

  return { totalW: frameOuterW, totalH: frameOuterH }
}

function drawWallGrain(ctx, w, h) {
  const { wallPlasterCanvas } = getTextures()
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (wallPlasterCanvas) {
    // Cover the wall with the photographed plaster grit (high-pass, so it
    // tints with the chosen wall colour instead of painting a grey slab).
    const iw = wallPlasterCanvas.width
    const ih = wallPlasterCanvas.height
    const scale = Math.max(w / iw, h / ih)
    const dw = iw * scale
    const dh = ih * scale
    ctx.globalCompositeOperation = 'soft-light'
    ctx.globalAlpha = 0.34
    ctx.drawImage(wallPlasterCanvas, (w - dw) / 2, (h - dh) / 2, dw, dh)
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = 0.1
    ctx.drawImage(wallPlasterCanvas, (w - dw) / 2, (h - dh) / 2, dw, dh)
  } else {
    const scale = 0.45
    const nw = Math.max(2, Math.round(w * scale))
    const nh = Math.max(2, Math.round(h * scale))
    const noiseCanvas = document.createElement('canvas')
    noiseCanvas.width = nw
    noiseCanvas.height = nh
    const nctx = noiseCanvas.getContext('2d')
    const nData = nctx.createImageData(nw, nh)
    let rnd = 17
    const rand = () => {
      rnd = (rnd * 9301 + 49297) % 233280
      return rnd / 233280
    }
    for (let i = 0; i < nData.data.length; i += 4) {
      const v = 128 + (rand() - 0.5) * 36
      nData.data[i] = v
      nData.data[i + 1] = v
      nData.data[i + 2] = v
      nData.data[i + 3] = 255
    }
    nctx.putImageData(nData, 0, 0)
    ctx.globalAlpha = 0.06
    ctx.globalCompositeOperation = 'overlay'
    ctx.drawImage(noiseCanvas, 0, 0, w, h)
  }
  ctx.restore()
}

function drawWall(ctx, w, h, wallHex) {
  const rgb = hexToRgb(wallHex)
  // A photographed wall is very nearly flat: a broad radial falloff spread over
  // the whole diagonal, only a few percent deep. The previous linear ramp moved
  // 13% across half the canvas, which is far past the point where the eye reads
  // it as a gradient graphic instead of a lit surface.
  const cx = w * 0.34
  const cy = h * 0.26
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.95)
  grad.addColorStop(0, shade(rgb, 0.035))
  grad.addColorStop(1, shade(rgb, -0.03))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  drawWallGrain(ctx, w, h)
}

export function computeCompositeDims({ pieces, frameWidthPct, matWidthPct, layout }) {
  const ready = pieces.filter((p) => p.rectified)
  if (!ready.length) return null
  const targetH = 700
  const scaled = ready.map((p) => {
    const s = targetH / p.rectified.height
    return { p, w: Math.round(p.rectified.width * s), h: targetH, s }
  })
  const frameW = Math.round(18 * (frameWidthPct / 100))
  const matW = Math.round(34 * (matWidthPct / 100))
  // Margin has to clear the drop shadow's reach, which now scales with the
  // panel rather than the moulding, or the shadow gets cropped at the canvas
  // edge and the piece stops looking like it is sitting on a wall.
  const panelH = targetH + frameW * 2 + matW * 2
  // The shadow scales off the average of the panel's two dimensions, so a wide
  // piece needs a wider margin than its height alone would suggest.
  const widestPanel = Math.max(...scaled.map((s) => s.w)) + frameW * 2 + matW * 2
  const shadowScale = (widestPanel + panelH) / 2
  const margin = Math.round(Math.max(110, frameW * 9, shadowScale * 0.22))
  // Keep enough wall between frames that the right-hand shadow of one
  // does not run into the next piece.
  const gap = Math.round(Math.max(120, shadowScale * 0.18))
  let totalW = margin * 2
  scaled.forEach((s) => {
    totalW += s.w + frameW * 2 + matW * 2
  })
  totalW += gap * (scaled.length - 1)
  const totalH = targetH + frameW * 2 + matW * 2 + margin * 2 + (layout === 'stagger' ? 40 : 0)
  return { scaled, frameW, matW, gap, margin, totalW: Math.round(totalW), totalH: Math.round(totalH) }
}

export function renderScene({
  pieces,
  frameWidthPct,
  matWidthPct,
  layout,
  wallColor,
  frameColor,
  textureKey,
  glaze = 'matte',
}) {
  const dims = computeCompositeDims({ pieces, frameWidthPct, matWidthPct, layout })
  if (!dims) return null
  const { scaled, frameW, matW, gap, margin, totalW, totalH } = dims

  const canvas = document.createElement('canvas')
  canvas.width = totalW
  canvas.height = totalH
  const ctx = canvas.getContext('2d')
  drawWall(ctx, totalW, totalH, wallColor)

  let cursorX = margin
  scaled.forEach((s, i) => {
    const artCanvas = document.createElement('canvas')
    artCanvas.width = Math.round(s.w)
    artCanvas.height = Math.round(s.h)
    artCanvas.getContext('2d').drawImage(s.p.rectified, 0, 0, artCanvas.width, artCanvas.height)
    let yOff = margin
    if (layout === 'stagger') yOff += i % 2 === 0 ? 0 : 40
    drawFramedPiece(ctx, cursorX, yOff, artCanvas, frameW, matW, frameColor, '#faf8f4', textureKey, wallColor, glaze)
    cursorX += artCanvas.width + frameW * 2 + matW * 2 + gap
  })

  return canvas
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function downloadCanvasPng(canvas, filename) {
  // Built synchronously (not via canvas.toBlob's async callback) so the
  // share/click calls below still run within the click's user-activation
  // window — iOS Safari silently rejects navigator.share() once that
  // window has lapsed.
  const blob = dataUrlToBlob(canvas.toDataURL('image/png'))

  // iOS Safari ignores the `download` attribute on data: URLs, so a plain
  // anchor click silently does nothing there. Use the share sheet (which
  // offers "Save Image") when the platform can share files.
  if (navigator.canShare && navigator.share) {
    const file = new File([blob], filename, { type: 'image/png' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
        // fall through to the anchor-download path below
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
