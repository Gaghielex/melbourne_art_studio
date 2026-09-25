import { applyFeatheredCorners, clamp255, gaussianBlurAlpha, gaussianBlurRGB, roundRectPath } from './blur.js'
import { applyLighting, getLightPreset, hexToRgb, hslToRgb, rgbToHsl, shade } from './color.js'
import { applyCompositeFilters, DEFAULT_FILTERS } from './filters.js'
import { drawContinuousOverlay, getCachedWallTexture, getTextures } from './textures.js'
import { DECKLE_PROFILES } from './deckleProfiles.js'

const DEFAULT_LIGHT_PRESET = getLightPreset('museum')
const DEFAULT_LIGHTING = {
  style: 'museum',
  colorTemp: 0,
  intensity: 1,
  preset: DEFAULT_LIGHT_PRESET,
}

export function makeLighting(lightStyle = 'museum', colorTemp = 0, intensity = 1) {
  return {
    style: lightStyle,
    colorTemp,
    intensity,
    preset: getLightPreset(lightStyle),
  }
}

function sceneIntensity(lighting) {
  // Picture light: the slider only drives the cone. Wall/frame/mat stay at
  // neutral intensity so raising it doesn't lift the whole room.
  return lighting.style === 'picture' ? 1 : lighting.intensity
}

function litWallColor(wallColor, colorTemp, lighting) {
  return applyLighting(wallColor, colorTemp, sceneIntensity(lighting) * (1 - lighting.preset.wallDarken))
}

function smoothStep(a, b, v) {
  const u = Math.max(0, Math.min(1, (v - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

function buildFrameTexture(frameOuterW, frameOuterH, frameW, seed, lightPreset = DEFAULT_LIGHT_PRESET) {
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
  // v2 PRD §3.7 — the light STYLE (Museum/Picture light/Window) moves this
  // vector; drop-shadow direction and glass sheen angle move with it too, so
  // the whole scene reads as one consistent light source.
  const lx = lightPreset.lx
  const ly = lightPreset.ly
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

function tintFrameTexture(srcCanvas, hex) {
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
    dd[i] = shaded.r
    dd[i + 1] = shaded.g
    dd[i + 2] = shaded.b
    dd[i + 3] = sd[i + 3]
  }
  octx.putImageData(dst, 0, 0)
  return out
}

// Specular lives in reflectMap so it can sit on top of grain. Soft-light /
// multiply over the mitre glint was texturing the joint and killing the
// arris. Grain is also faded out along the seam so it meets at 45° instead
// of running across the cut.
function applyMitreSheen(canvas, reflectMap, frameW, bodyData) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const body = bodyData?.data
  const seamSigma = Math.max(1.2, frameW * 0.055)
  for (let y = 0, p = 0; y < h; y++) {
    for (let x = 0; x < w; x++, p++) {
      const i = p * 4
      if (body) {
        const dH = Math.min(x, w - 1 - x)
        const dV = Math.min(y, h - 1 - y)
        const seamDist = Math.abs(dH - dV) * Math.SQRT1_2
        const fall = Math.exp(-Math.pow(seamDist / seamSigma, 2))
        if (fall > 0.01) {
          const k = 1 - fall
          d[i] = body[i] * fall + d[i] * k
          d[i + 1] = body[i + 1] * fall + d[i + 1] * k
          d[i + 2] = body[i + 2] * fall + d[i + 2] * k
        }
      }
      const sheen = reflectMap[p]
      if (sheen > 0.4) {
        d[i] = clamp255(d[i] + sheen)
        d[i + 1] = clamp255(d[i + 1] + sheen)
        d[i + 2] = clamp255(d[i + 2] + sheen)
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}

function drawGlassSheen(ctx, rx, ry, rw, rh, seed, lighting = DEFAULT_LIGHTING) {
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
  const angle = ((lighting.preset.sheenAngle + rnd(3) * 14) * Math.PI) / 180

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

// depthScale scales the shadow's offset/blur/peak-darkness down for
// objects that sit much closer to the wall than a framed piece — a sheet
// of paper or a print doesn't cast the same shadow a moulding does. 1 =
// the original frame-tuned shadow.
function drawContactWallShadow(ctx, x, y, w, h, cornerR, wallColor, depthScale = 1, lighting = DEFAULT_LIGHTING) {
  // One solid, one blur, then punch. The blur is the gradient — a
  // second distance field is what stacked or chamfered the corner.
  const panel = (w + h) / 2
  const ox = panel * lighting.preset.shadowOxFactor * depthScale
  const oy = panel * lighting.preset.shadowOyFactor * depthScale
  const blurR = Math.max(2, Math.round(panel * 0.012 * depthScale))
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
    out[p + 3] = clamp255(Math.pow(t, 1.55) * 255 * 0.82 * depthScale)
  }
  octx.putImageData(data, 0, 0)

  octx.globalCompositeOperation = 'destination-out'
  octx.fillStyle = '#000'
  roundRectPath(octx, pad, pad, w, h, Math.max(2, cornerR))
  octx.fill()

  ctx.drawImage(oc, x - pad, y - pad)
}

// Same soft, tinted contact shadow as drawContactWallShadow, but traced from
// a real silhouette (maskCanvas's own alpha, e.g. a deckled paper edge)
// instead of a rounded rect — so a torn edge casts a shadow that follows its
// own irregular boundary rather than a clean rectangle underneath it.
function drawContactShadowFromMask(ctx, x, y, maskCanvas, wallColor, depthScale = 1, lighting = DEFAULT_LIGHTING) {
  const w = maskCanvas.width
  const h = maskCanvas.height
  const panel = (w + h) / 2
  const ox = panel * lighting.preset.shadowOxFactor * 0.35 * depthScale
  const oy = panel * lighting.preset.shadowOyFactor * 0.35 * depthScale
  const blurR = Math.max(1.5, panel * 0.006 * depthScale)
  const pad = Math.ceil(blurR * 3 + 8)
  const ow = Math.ceil(w + pad * 2 + ox)
  const oh = Math.ceil(h + pad * 2 + oy)

  const oc = document.createElement('canvas')
  oc.width = ow
  oc.height = oh
  const octx = oc.getContext('2d', { willReadFrequently: true })
  octx.drawImage(maskCanvas, Math.round(pad + ox), Math.round(pad + oy))

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
    out[p + 3] = clamp255(Math.pow(t, 1.55) * 255 * 0.7 * depthScale)
  }
  octx.putImageData(data, 0, 0)

  octx.globalCompositeOperation = 'destination-out'
  octx.drawImage(maskCanvas, Math.round(pad), Math.round(pad))

  ctx.drawImage(oc, x - pad, y - pad)
}

// Shared by every style that has a real moulding (Framed+mat, Framed no
// mat, Float mount): builds the tinted, grain-textured, corner-feathered
// frame ring canvas. Callers draw it at (x, y) and then fill in whatever
// sits inside it (mat + art, or a backing board + floating paper).
function buildTintedFrame(
  frameOuterW,
  frameOuterH,
  frameW,
  frameColor,
  textureKey,
  seed,
  lighting = DEFAULT_LIGHTING,
  frameTextureIntensity = 1,
) {
  const frameTex = buildFrameTexture(
    Math.round(frameOuterW),
    Math.round(frameOuterH),
    Math.round(frameW),
    seed,
    lighting.preset,
  )
  const tinted = tintFrameTexture(frameTex.canvas, frameColor)

  const {
    textureCanvases,
    textureCanvasesRotated,
    textureCanvasesLight,
    textureCanvasesLightRotated,
    texturesReady,
  } = getTextures()
  let bodyBeforeGrain = null
  if (texturesReady) {
    bodyBeforeGrain = tinted.getContext('2d').getImageData(0, 0, tinted.width, tinted.height)
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
    const paint = hexToRgb(frameColor)
    const luma = (0.299 * paint.r + 0.587 * paint.g + 0.114 * paint.b) / 255
    // Same high-pass grain at every lightness — a hard luma cutoff made the
    // texture vanish as soon as the picker crossed into light. Soft-light
    // stays on (what reads on dark); multiply of the dark veins eases in
    // toward white so pale paint still shows pores.
    const drawSides = (tex, texRot, alpha, mode, scale) => {
      const a = Math.max(0, Math.min(1, alpha * frameTextureIntensity))
      if (!tex || a < 0.02) return
      drawContinuousOverlay(tctx, topPts, texRot, a, mode, scale)
      drawContinuousOverlay(tctx, botPts, texRot, a, mode, scale)
      drawContinuousOverlay(tctx, leftPts, tex, a, mode, scale)
      drawContinuousOverlay(tctx, rightPts, tex, a, mode, scale)
    }
    const softAlpha = 0.58 + (1 - luma) * 0.3
    drawSides(
      textureCanvases[textureKey],
      textureCanvasesRotated[textureKey],
      softAlpha,
      'soft-light',
      2.6,
    )
    if (luma > 0.4) {
      drawSides(
        textureCanvasesLight[textureKey],
        textureCanvasesLightRotated[textureKey],
        0.2 + (luma - 0.4) * 0.6,
        'multiply',
        1.4,
      )
    }
  }

  applyMitreSheen(tinted, frameTex.reflectMap, frameW, bodyBeforeGrain)

  // The timber's outer arris is only lightly eased. A radius proportional to
  // a quarter of the moulding made the whole corner look out of focus. The
  // canvas path already anti-aliases the tiny eased corner — do not blur the
  // silhouette: straight timber edges must remain optically crisp.
  const cornerR = Math.max(0.75, frameW * 0.055)
  applyFeatheredCorners(tinted, cornerR, 0)
  return { canvas: tinted, cornerR }
}

function drawFramedPiece(
  ctx,
  x,
  y,
  artCanvas,
  frameW,
  matW,
  frameColor,
  matColor,
  textureKey,
  wallColor,
  glaze,
  skipShadow,
  lighting = DEFAULT_LIGHTING,
  frameTextureIntensity = 1,
) {
  const aw = artCanvas.width
  const ah = artCanvas.height
  const matOuterW = aw + matW * 2
  const matOuterH = ah + matW * 2
  const frameOuterW = matOuterW + frameW * 2
  const frameOuterH = matOuterH + frameW * 2
  const cornerR = Math.max(0.75, frameW * 0.055)

  if (!skipShadow) drawContactWallShadow(ctx, x, y, frameOuterW, frameOuterH, cornerR, wallColor, 1, lighting)

  const { canvas: tinted } = buildTintedFrame(
    frameOuterW,
    frameOuterH,
    frameW,
    frameColor,
    textureKey,
    Math.round(x * 7 + y * 13) + 1,
    lighting,
    frameTextureIntensity,
  )
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
    drawGlassSheen(ctx, x + frameW, y + frameW, matOuterW, matOuterH, Math.round(x + y), lighting)
  }

  return { totalW: frameOuterW, totalH: frameOuterH }
}

// Deckled (torn) paper edge — an irregular alpha mask carved into the
// canvas's border, driven by real tear-intrusion profiles extracted from a
// photographed torn-paper sheet (deckleProfiles.js) rather than synthetic
// noise: sine+random noise read as fake no matter how it was tuned, per v1
// PRD §8.1's lesson that real photographed material beats more synthetic
// tuning. Each piece samples the 4 real profiles with a seeded phase offset,
// mirror, and edge-to-edge permutation so a series doesn't repeat the same
// edge, with a soft (partially translucent) boundary rather than a hard line.
function sampleDeckleProfile(profile, u, offset, mirror) {
  const n = profile.length
  const uu = mirror ? 1 - u : u
  const pos = (((uu + offset) % 1) + 1) % 1
  const f = pos * (n - 1)
  const i0 = Math.floor(f)
  const i1 = (i0 + 1) % n
  const t = f - i0
  return profile[i0] * (1 - t) + profile[i1] * t
}

// Tear depth is a property of the sheet edge, not the paper-border width.
// A wide unframed margin used to scale the bite with it and read as scrap.
function sheetDeckleDepth(w, h) {
  return Math.max(12, Math.min(24, Math.min(w, h) * 0.04))
}

function applyDeckledEdge(canvas, seed, depth) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data

  let rnd = (seed || 1) >>> 0
  const random = () => {
    rnd = (rnd * 1664525 + 1013904223) >>> 0
    return rnd / 4294967296
  }
  const sourceEdges = [DECKLE_PROFILES.top, DECKLE_PROFILES.bottom, DECKLE_PROFILES.left, DECKLE_PROFILES.right]
  // Keep a high floor so the silhouette stays nearly rectangular; the
  // photographed profile only supplies a small tooth on top of that.
  const edgeProfile = (n) => {
    const source = sourceEdges[Math.floor(random() * sourceEdges.length)]
    const offset = random()
    const mirror = random() < 0.5
    const profile = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const raw = sampleDeckleProfile(source, i / n, offset, mirror)
      profile[i] = depth * (0.52 + raw * 0.48)
    }
    return profile
  }
  const topP = edgeProfile(w)
  const botP = edgeProfile(w)
  const leftP = edgeProfile(h)
  const rightP = edgeProfile(h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const distTop = y - topP[x]
      const distBot = h - 1 - y - botP[x]
      const distLeft = x - leftP[y]
      const distRight = w - 1 - x - rightP[y]
      const minDist = Math.min(distTop, distBot, distLeft, distRight)
      const i = (y * w + x) * 4
      if (minDist < 0) {
        data[i + 3] = 0
      } else if (minDist < 2.4) {
        const fade = minDist / 2.4
        data[i] = clamp255(data[i] * (0.84 + fade * 0.16))
        data[i + 1] = clamp255(data[i + 1] * (0.82 + fade * 0.18))
        data[i + 2] = clamp255(data[i + 2] * (0.78 + fade * 0.22))
        data[i + 3] = Math.round(data[i + 3] * Math.min(1, fade * 1.15))
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function paperGrainDest(w, h, seed, tex) {
  const scale = Math.max(w / tex.width, h / tex.height)
  const dw = tex.width * scale
  const dh = tex.height * scale
  return {
    dw,
    dh,
    ox: dw > w ? ((seed || 1) * 17) % (dw - w) : (w - dw) / 2,
    oy: dh > h ? ((seed || 1) * 31) % (dh - h) : (h - dh) / 2,
  }
}

function drawPaperMap(ctx, tex, w, h, seed, mode = 'source-over', alpha = 1) {
  if (!tex) return false
  const { dw, dh, ox, oy } = paperGrainDest(w, h, seed, tex)
  ctx.save()
  ctx.globalCompositeOperation = mode
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(tex, -ox, -oy, dw, dh)
  ctx.restore()
  return true
}

function drawPaperGrain(ctx, w, h, seed, mode = 'source-over', alpha = 1) {
  return drawPaperMap(ctx, getTextures().paperGrainCanvas, w, h, seed, mode, alpha)
}

function drawSurfaceMap(ctx, tex, dx, dy, dw, dh, seed, mode = 'overlay', alpha = 1, repeats = 1) {
  if (!tex || dw <= 0 || dh <= 0) return false
  const destShort = Math.min(dw, dh)
  const texShort = Math.min(tex.width, tex.height)
  const scale = repeats > 1 ? destShort / (texShort * repeats) : Math.max(dw / tex.width, dh / tex.height)
  const tw = tex.width * scale
  const th = tex.height * scale
  ctx.save()
  ctx.beginPath()
  ctx.rect(dx, dy, dw, dh)
  ctx.clip()
  ctx.globalCompositeOperation = mode
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (repeats > 1) {
    const ox = ((seed || 1) * 17) % tw
    const oy = ((seed || 1) * 31) % th
    for (let y = dy - oy; y < dy + dh; y += th) {
      for (let x = dx - ox; x < dx + dw; x += tw) {
        ctx.drawImage(tex, x, y, tw, th)
      }
    }
  } else {
    const ox = tw > dw ? ((seed || 1) * 17) % (tw - dw) : (dw - tw) / 2
    const oy = th > dh ? ((seed || 1) * 31) % (th - dh) : (dh - th) / 2
    ctx.drawImage(tex, dx - ox, dy - oy, tw, th)
  }
  ctx.restore()
  return true
}

// Overlay the sheet's fine tooth over the finished card so it continues
// across the artwork, aligned with the border grain (same seed).
function applyPaperTooth(canvas, seed) {
  const { paperToothCanvas } = getTextures()
  drawPaperMap(canvas.getContext('2d'), paperToothCanvas, canvas.width, canvas.height, seed, 'overlay', 0.55)
}

// Paper surface — the interior of the same photographed sheet as the
// deckled edge, drawn as one continuous card (seeded crop, not a tiled
// high-pass). Procedural noise only until that texture has loaded.
function makePaperBase(w, h, seed) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f7f4ef'
  ctx.fillRect(0, 0, w, h)

  if (!drawPaperGrain(ctx, w, h, seed)) {
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    let rnd = (seed || 1) >>> 0
    const random = () => {
      rnd = (rnd * 1664525 + 1013904223) >>> 0
      return rnd / 4294967296
    }
    for (let i = 0; i < d.length; i += 4) {
      const n = (random() - 0.5) * 6
      d[i] = clamp255(d[i] + n)
      d[i + 1] = clamp255(d[i + 1] + n)
      d[i + 2] = clamp255(d[i + 2] + n)
    }
    ctx.putImageData(img, 0, 0)
  }
  return canvas
}

function assemblePaperSheet(w, h, seed, drawArt, deckleDepth) {
  const paper = makePaperBase(w, h, seed)
  drawArt(paper.getContext('2d'))
  applyPaperTooth(paper, seed)
  if (deckleDepth > 0) applyDeckledEdge(paper, seed, deckleDepth)
  return paper
}

function applyEdgeIrregularity(sourceCanvas, seed, depth) {
  const w = sourceCanvas.width
  const h = sourceCanvas.height
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.drawImage(sourceCanvas, 0, 0)

  const { edgeMaskCanvases } = getTextures()
  const band = Math.max(6, depth)
  ;[
    { key: 'top', rx: 0, ry: 0, rw: w, rh: band, dx: 0, dy: 0, dw: w, dh: band },
    { key: 'bottom', rx: 0, ry: h - band, rw: w, rh: band, dx: 0, dy: h - band, dw: w, dh: band },
    { key: 'left', rx: 0, ry: 0, rw: band, rh: h, dx: 0, dy: 0, dw: band, dh: h },
    { key: 'right', rx: w - band, ry: 0, rw: band, rh: h, dx: w - band, dy: 0, dw: band, dh: h },
  ].forEach(({ key, rx, ry, rw, rh, dx, dy, dw, dh }) => {
    const mask = edgeMaskCanvases && edgeMaskCanvases[key]
    if (!mask || rw <= 0 || rh <= 0) return
    ctx.save()
    ctx.beginPath()
    ctx.rect(rx, ry, rw, rh)
    ctx.clip()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(mask, dx, dy, dw, dh)
    ctx.restore()
  })
  return c
}

// Float mount: paper with a deckled edge on a plain backing board, inside
// the same procedural frame moulding — the "deeper" read comes from the
// board showing plainly around the paper and the paper's own small
// contact shadow, not a different frame shader.
function drawFloatMount(
  ctx,
  x,
  y,
  artCanvas,
  frameW,
  boardW,
  frameColor,
  boardColor,
  textureKey,
  wallColor,
  glaze,
  seed,
  skipShadow,
  paperEdge = 'border',
  lighting = DEFAULT_LIGHTING,
  frameTextureIntensity = 1,
) {
  const aw = artCanvas.width
  const ah = artCanvas.height
  const boardOuterW = aw + boardW * 2
  const boardOuterH = ah + boardW * 2
  const frameOuterW = boardOuterW + frameW * 2
  const frameOuterH = boardOuterH + frameW * 2
  const cornerR = Math.max(0.75, frameW * 0.055)

  if (!skipShadow) drawContactWallShadow(ctx, x, y, frameOuterW, frameOuterH, cornerR, wallColor, 1, lighting)

  const { canvas: tinted } = buildTintedFrame(
    frameOuterW,
    frameOuterH,
    frameW,
    frameColor,
    textureKey,
    Math.round(x * 7 + y * 13) + 1,
    lighting,
    frameTextureIntensity,
  )
  ctx.drawImage(tinted, x, y)

  const boardRgb = hexToRgb(boardColor)
  ctx.fillStyle = `rgb(${boardRgb.r},${boardRgb.g},${boardRgb.b})`
  ctx.fillRect(x + frameW, y + frameW, boardOuterW, boardOuterH)

  // v2 PRD §3.4 — the gap between the artwork and its torn edge, matching a
  // real deckle-edge print's 1-2cm paper border. "Full bleed" removes that
  // gap entirely — no paper margin ring, artwork covers the whole sheet and
  // the tear is carved directly into its own edge.
  let paper, paperX, paperY
  if (paperEdge === 'bleed') {
    paperX = x + frameW + boardW
    paperY = y + frameW + boardW
    paper = assemblePaperSheet(aw, ah, seed, (pctx) => pctx.drawImage(artCanvas, 0, 0), sheetDeckleDepth(aw, ah))
  } else {
    const paperMargin = decklePaperMargin(boardW)
    paperX = x + frameW + boardW - paperMargin
    paperY = y + frameW + boardW - paperMargin
    const irregularArt = applyEdgeIrregularity(artCanvas, seed + 101, Math.max(60, Math.min(aw, ah) * 0.09))
    paper = assemblePaperSheet(
      aw + paperMargin * 2,
      ah + paperMargin * 2,
      seed,
      (pctx) => pctx.drawImage(irregularArt, paperMargin, paperMargin),
      sheetDeckleDepth(aw + paperMargin * 2, ah + paperMargin * 2),
    )
  }
  drawContactShadowFromMask(ctx, paperX, paperY, paper, boardColor, 0.5, lighting)
  ctx.drawImage(paper, paperX, paperY)

  if (glaze === 'glass') {
    drawGlassSheen(ctx, x + frameW, y + frameW, boardOuterW, boardOuterH, Math.round(x + y), lighting)
  }
  return { totalW: frameOuterW, totalH: frameOuterH }
}

// Unframed paper: deckled-edge sheet on the wall with a soft contact
// shadow — no frame, no mat, no pins/tape/clip.
function drawUnframedPaper(
  ctx,
  x,
  y,
  artCanvas,
  borderMargin,
  wallColor,
  seed,
  skipShadow,
  paperEdge = 'border',
  lighting = DEFAULT_LIGHTING,
) {
  const aw = artCanvas.width
  const ah = artCanvas.height
  let paper, paperW, paperH

  if (paperEdge === 'bleed') {
    // v2 PRD §3.4 — "Full bleed": no paper margin at all, so there's no
    // visible paper-colour ring around the image. The artwork covers the
    // whole sheet and the tear is carved directly into its own edge
    // afterward, only exposing the paper grain in the tear's inward notches.
    paperW = aw
    paperH = ah
    paper = assemblePaperSheet(paperW, paperH, seed, (pctx) => pctx.drawImage(artCanvas, 0, 0), sheetDeckleDepth(paperW, paperH))
  } else {
    const paperMargin = borderMargin
    paperW = aw + paperMargin * 2
    paperH = ah + paperMargin * 2
    const irregularArt = applyEdgeIrregularity(artCanvas, seed + 101, Math.max(60, Math.min(aw, ah) * 0.09))
    paper = assemblePaperSheet(
      paperW,
      paperH,
      seed,
      (pctx) => pctx.drawImage(irregularArt, paperMargin, paperMargin),
      sheetDeckleDepth(paperW, paperH),
    )
  }

  // Paper sits much closer to the wall than a moulding, and its shadow
  // should trace the torn edge rather than a clean rectangle — a
  // frame-scale rect shadow made it read as a thick object floating off
  // the wall with a silhouette that didn't match its own edge.
  if (!skipShadow) drawContactShadowFromMask(ctx, x, y, paper, wallColor, 0.45, lighting)

  ctx.drawImage(paper, x, y)

  return { totalW: paperW, totalH: paperH }
}

// Overlay a surface grain on the artwork pixels only — not the mat,
// paper margin, or frame. High-pass maps stay mid-grey so ink colour
// survives; dual overlay + soft-light is what makes weave/tooth read
// on both light and dark prints.
// v2 PRD §3.13 — texture intensity controls. `intensity` is a 0..2 multiplier
// (1 = the original tuned alpha, 0 = texture off, 2 = doubled) on top of each
// texture's own overlay/soft-light alpha, clamped so it never exceeds fully
// opaque.
export function applyArtTexture(artCanvas, artTexture = 'none', seed = 1, intensity = 1) {
  if (!artTexture || artTexture === 'none' || intensity <= 0) return
  const { paperToothCanvas, canvasWeaveCanvas, woodPanelCanvas } = getTextures()
  const ctx = artCanvas.getContext('2d')
  const w = artCanvas.width
  const h = artCanvas.height
  const maps = {
    paper: { tex: paperToothCanvas, overlay: 0.68, soft: 0.32, repeats: 1 },
    canvas: { tex: canvasWeaveCanvas, overlay: 0.48, soft: 0.22, repeats: 3.2 },
    'wood-panel': { tex: woodPanelCanvas, overlay: 0.42, soft: 0.2, repeats: 2.4 },
  }
  const spec = maps[artTexture]
  if (!spec?.tex) return
  const clampAlpha = (a) => Math.max(0, Math.min(1, a * intensity))
  drawSurfaceMap(ctx, spec.tex, 0, 0, w, h, seed, 'overlay', clampAlpha(spec.overlay), spec.repeats)
  drawSurfaceMap(ctx, spec.tex, 0, 0, w, h, seed, 'soft-light', clampAlpha(spec.soft), spec.repeats)
}

// No frame (print): the artwork only, clean edges, soft drop shadow.
function drawPrintNoFrame(ctx, x, y, artCanvas, wallColor, skipShadow, lighting = DEFAULT_LIGHTING) {
  const w = artCanvas.width
  const h = artCanvas.height
  if (!skipShadow) drawContactWallShadow(ctx, x, y, w, h, 1, wallColor, 0.3, lighting)
  ctx.drawImage(artCanvas, x, y)
  return { totalW: w, totalH: h }
}

// v2 PRD §3.4 — presentation styles.
export const PRESENTATION_STYLES = [
  { key: 'framed-mat', label: 'Framed + mat' },
  { key: 'framed-no-mat', label: 'Framed, no mat' },
  { key: 'float-mount', label: 'Float mount' },
  { key: 'unframed-paper', label: 'Unframed paper' },
  { key: 'print', label: 'No frame (print)' },
]

// Translates the user's frame-width/mat-width sliders into whatever those
// two numbers actually mean for the chosen style, so the shared
// panel/margin/gap arrangement machinery doesn't need to know about
// styles at all — it just sees a (frameW, matW) pair either way.
export function decklePaperMargin(matW) {
  const boardW = Math.max(matW, 1)
  return Math.min(boardW * 0.85, Math.max(10, boardW * 0.35) * 3.6) * 0.9
}

export function unframedPaperMargin(matW, paperEdge = 'border') {
  if (paperEdge === 'bleed') return 0
  return decklePaperMargin(matW)
}

export function effectiveDimsForStyle(style, frameW, matW, paperEdge = 'border') {
  switch (style) {
    case 'framed-no-mat':
      return { frameW, matW: 0 }
    case 'float-mount':
      return { frameW, matW } // matW doubles as the backing-board margin
    case 'unframed-paper':
      return { frameW: 0, matW: unframedPaperMargin(matW, paperEdge) }
    case 'print':
      return { frameW: 0, matW: 0 }
    default:
      return { frameW, matW } // 'framed-mat'
  }
}

export function drawPresentedPiece(
  ctx,
  x,
  y,
  artCanvas,
  frameW,
  matW,
  frameColor,
  matColor,
  textureKey,
  wallColor,
  glaze,
  style,
  seed,
  skipShadow = false,
  paperEdge = 'border',
  lighting = DEFAULT_LIGHTING,
  artTexture = 'none',
  artTextureIntensity = 1,
  frameTextureIntensity = 1,
) {
  applyArtTexture(artCanvas, artTexture, seed, artTextureIntensity)
  switch (style) {
    case 'framed-no-mat':
      return drawFramedPiece(
        ctx,
        x,
        y,
        artCanvas,
        frameW,
        0,
        frameColor,
        matColor,
        textureKey,
        wallColor,
        glaze,
        skipShadow,
        lighting,
        frameTextureIntensity,
      )
    case 'float-mount':
      return drawFloatMount(
        ctx,
        x,
        y,
        artCanvas,
        frameW,
        matW,
        frameColor,
        matColor,
        textureKey,
        wallColor,
        glaze,
        seed,
        skipShadow,
        paperEdge,
        lighting,
        frameTextureIntensity,
      )
    case 'unframed-paper':
      return drawUnframedPaper(ctx, x, y, artCanvas, matW, wallColor, seed, skipShadow, paperEdge, lighting)
    case 'print':
      return drawPrintNoFrame(ctx, x, y, artCanvas, wallColor, skipShadow, lighting)
    default:
      return drawFramedPiece(
        ctx,
        x,
        y,
        artCanvas,
        frameW,
        matW,
        frameColor,
        matColor,
        textureKey,
        wallColor,
        glaze,
        skipShadow,
        lighting,
        frameTextureIntensity,
      )
  }
}

function drawWallGrain(ctx, w, h, wallTextureCanvas, wallTextureIntensity = 1) {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const clampAlpha = (a) => Math.max(0, Math.min(1, a * wallTextureIntensity))
  if (wallTextureCanvas) {
    // Cover the wall with the photographed texture (high-pass, so it tints
    // with the chosen wall colour instead of painting a flat slab).
    const iw = wallTextureCanvas.width
    const ih = wallTextureCanvas.height
    const scale = Math.max(w / iw, h / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = (w - dw) / 2
    const dy = (h - dh) / 2
    // Photographed wall maps are often low-contrast (especially plaster /
    // limewash). Boost local contrast before blending so the grain reads
    // on a light gallery wall without replacing the chosen wall colour.
    ctx.filter = 'contrast(1.85) saturate(0.35)'
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = clampAlpha(0.58)
    ctx.drawImage(wallTextureCanvas, dx, dy, dw, dh)
    ctx.filter = 'contrast(1.45)'
    ctx.globalCompositeOperation = 'soft-light'
    ctx.globalAlpha = clampAlpha(0.72)
    ctx.drawImage(wallTextureCanvas, dx, dy, dw, dh)
    ctx.filter = 'none'
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
    ctx.globalAlpha = clampAlpha(0.06)
    ctx.globalCompositeOperation = 'overlay'
    ctx.drawImage(noiseCanvas, 0, 0, w, h)
  }
  ctx.restore()
}

function drawWall(ctx, w, h, wallHex, wallTextureCanvas, lighting = DEFAULT_LIGHTING, wallTextureIntensity = 1) {
  const rgb = hexToRgb(wallHex)
  const style = lighting.style
  if (style === 'window') {
    const grad = ctx.createLinearGradient(0, 0, w, h * 0.2)
    grad.addColorStop(0, shade(rgb, 0.055))
    grad.addColorStop(0.45, shade(rgb, 0.01))
    grad.addColorStop(1, shade(rgb, -0.07))
    ctx.fillStyle = grad
  } else if (style === 'picture') {
    ctx.fillStyle = shade(rgb, -0.16)
  } else {
    const cx = w * 0.34
    const cy = h * 0.26
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.95)
    grad.addColorStop(0, shade(rgb, 0.035))
    grad.addColorStop(1, shade(rgb, -0.03))
    ctx.fillStyle = grad
  }
  ctx.fillRect(0, 0, w, h)
  drawWallGrain(ctx, w, h, wallTextureCanvas, wallTextureIntensity)
}

function drawPictureLightCones(ctx, positions, frameW, matW, intensity, canvasW, canvasH) {
  const t = Math.max(0.4, Math.min(1.7, intensity))
  const hot = (t - 0.4) / 1.3
  const peak = 0.55 + hot * 0.42

  ctx.save()
  positions.forEach(({ scaled, x, y }) => {
    const pw = scaled.w + frameW * 2 + matW * 2
    const ph = scaled.h + frameW * 2 + matW * 2
    const cx = x + pw / 2
    const cy = y + ph * 0.4
    // Plateau stays bright across the piece and a wall halo, then falls
    // off toward the canvas corners — same shape as a museum track spot.
    const radius = Math.hypot(canvasW, canvasH) * 0.58
    const core = Math.max(pw, ph) * 0.38

    const g = ctx.createRadialGradient(cx, cy, core, cx, cy, radius)
    g.addColorStop(0, `rgba(255,255,255,${peak})`)
    g.addColorStop(0.22, `rgba(255,255,255,${peak * 0.72})`)
    g.addColorStop(0.5, `rgba(255,255,255,${peak * 0.28})`)
    g.addColorStop(0.78, `rgba(255,255,255,${peak * 0.08})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
}

// v2 PRD §3.6 — "Flat colour" background: solid colour with an extremely
// faint grain so large areas don't visibly banding-step, no wall lighting
// falloff (a flat studio backdrop, not a photographed surface).
function drawFlatBackground(ctx, w, h, hex) {
  const rgb = hexToRgb(hex)
  ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  const scale = 0.45
  const nw = Math.max(2, Math.round(w * scale))
  const nh = Math.max(2, Math.round(h * scale))
  const noiseCanvas = document.createElement('canvas')
  noiseCanvas.width = nw
  noiseCanvas.height = nh
  const nctx = noiseCanvas.getContext('2d')
  const nData = nctx.createImageData(nw, nh)
  let rnd = 91
  const rand = () => {
    rnd = (rnd * 9301 + 49297) % 233280
    return rnd / 233280
  }
  for (let i = 0; i < nData.data.length; i += 4) {
    const v = 128 + (rand() - 0.5) * 20
    nData.data[i] = v
    nData.data[i + 1] = v
    nData.data[i + 2] = v
    nData.data[i + 3] = 255
  }
  nctx.putImageData(nData, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.globalAlpha = 0.025
  ctx.globalCompositeOperation = 'overlay'
  ctx.drawImage(noiseCanvas, 0, 0, w, h)
  ctx.restore()
}

// v2 PRD §3.6 — "Blurred artwork" background: the feeding piece's own
// rectified image, scaled to cover the canvas, heavily blurred and slightly
// darkened/desaturated so the sharp pieces on top stay the clear focal point.
function drawBlurredArtworkBackground(ctx, w, h, sourceImage, blurRadius, dimAmount) {
  const dscale = 0.25
  const dw = Math.max(2, Math.round(w * dscale))
  const dh = Math.max(2, Math.round(h * dscale))
  const small = document.createElement('canvas')
  small.width = dw
  small.height = dh
  const sctx = small.getContext('2d', { willReadFrequently: true })
  const iw = sourceImage.width
  const ih = sourceImage.height
  const coverScale = Math.max(dw / iw, dh / ih)
  const sw = iw * coverScale
  const sh = ih * coverScale
  sctx.drawImage(sourceImage, (dw - sw) / 2, (dh - sh) / 2, sw, sh)

  const imgData = sctx.getImageData(0, 0, dw, dh)
  gaussianBlurRGB(imgData.data, dw, dh, Math.max(1, blurRadius * dscale))
  const d = imgData.data
  const dim = Math.max(0, Math.min(1, dimAmount))
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
    d[i] = clamp255(d[i] * (1 - dim * 0.5) * (1 - dim * 0.3) + gray * dim * 0.15)
    d[i + 1] = clamp255(d[i + 1] * (1 - dim * 0.5) * (1 - dim * 0.3) + gray * dim * 0.15)
    d[i + 2] = clamp255(d[i + 2] * (1 - dim * 0.5) * (1 - dim * 0.3) + gray * dim * 0.15)
  }
  sctx.putImageData(imgData, 0, 0)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, dw, dh, 0, 0, w, h)
}

// v2 PRD §3.6 — background mode dispatcher. Every renderScene call site used
// to draw the wall directly; this swaps in whichever mode the user picked
// without the layout/positioning code needing to know backgrounds exist.
function drawBackground(ctx, w, h, opts) {
  const {
    backgroundMode,
    wallColor,
    wallTextureCanvas,
    flatColor,
    blurSourceImage,
    blurRadius,
    dimAmount,
    lighting,
    wallTextureIntensity = 1,
  } = opts
  if (backgroundMode === 'flat') {
    drawFlatBackground(ctx, w, h, flatColor)
  } else if (backgroundMode === 'blurred' && blurSourceImage) {
    drawBlurredArtworkBackground(ctx, w, h, blurSourceImage, blurRadius, dimAmount)
  } else {
    drawWall(ctx, w, h, wallColor, wallTextureCanvas, lighting, wallTextureIntensity)
  }
}

// Every pixel-scale constant below (frame/mat base width, margin and gap
// floors, stagger offset) was tuned by eye at this resolution. Scaling them
// all by targetH / BASE_TARGET_H keeps preview and export proportionally
// identical at any resolution — only sharper, never differently laid out.
const BASE_TARGET_H = 700

// Output aspect ratio options (v2 PRD §3.2). `ratio` is width/height;
// null means Free — the canvas hugs the arrangement, v1 behaviour.
export const ASPECT_RATIOS = [
  { key: '4:5', label: '4:5', ratio: 4 / 5 },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
  { key: '3:2', label: '3:2', ratio: 3 / 2 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
  { key: 'free', label: 'Free', ratio: null },
]

// v2 PRD §3.3 — layout presets. Each is a starting point (free arrangement
// on top of any of these is a later task); the six share the same
// panel/margin/gap machinery so a future free-drag step can reposition any
// of them without caring which preset produced the initial layout.
export const LAYOUT_OPTIONS = [
  { key: 'row', label: 'Lined up' },
  { key: 'stagger', label: 'Salon-stagger' },
  { key: 'grid', label: 'Grid' },
  { key: 'pyramid', label: 'Pyramid' },
  { key: 'cluster', label: 'Cluster' },
  { key: 'column', label: 'Column' },
]

function scalePiece(p, targetH) {
  const scaleFactor = targetH / p.rectified.height
  return { p, w: Math.round(p.rectified.width * scaleFactor), h: Math.round(targetH), s: scaleFactor }
}

function panelDims(sc, frameW, matW) {
  return { w: sc.w + frameW * 2 + matW * 2, h: sc.h + frameW * 2 + matW * 2 }
}

// Derived from whichever single panel is widest and whichever is tallest
// (not necessarily the same panel) — reduces to the original Row/Stagger
// formula exactly when every panel shares one height, and generalizes
// sensibly to layouts with mixed panel sizes (Grid, Cluster).
function marginAndGap(artworks, s) {
  // Wall padding is derived from the artwork, not the moulding. Tying it to
  // frame/mat width used to pull the camera back as the frame got thicker,
  // so a full-width frame left the print looking tiny in the crop.
  const widest = Math.max(...artworks.map((p) => p.w))
  const tallest = Math.max(...artworks.map((p) => p.h))
  const shadowScale = (widest + tallest) / 2
  const margin = Math.round(Math.max(110 * s, shadowScale * 0.22))
  const gap = Math.round(Math.max(120 * s, shadowScale * 0.18))
  return { margin, gap }
}

// Lays a single row of already-scaled pieces out left-to-right, tight —
// positions relative to (0,0). `yOffsets` (same length as scaledPieces)
// lets the row layout also express salon-stagger without a separate code
// path.
function layoutRowArrangement(scaledPieces, frameW, matW, gap, yOffsets) {
  const positions = []
  let cursorX = 0
  let maxBottom = 0
  scaledPieces.forEach((sc, i) => {
    const { w: panelW, h: panelH } = panelDims(sc, frameW, matW)
    const y = yOffsets ? yOffsets[i] : 0
    positions.push({ scaled: sc, x: cursorX, y })
    cursorX += panelW + gap
    maxBottom = Math.max(maxBottom, y + panelH)
  })
  return { positions, contentW: cursorX - gap, contentH: maxBottom }
}

function layoutColumnArrangement(scaledPieces, frameW, matW, gap) {
  const positions = []
  let cursorY = 0
  scaledPieces.forEach((sc) => {
    const { h: panelH } = panelDims(sc, frameW, matW)
    positions.push({ scaled: sc, x: 0, y: cursorY })
    cursorY += panelH + gap
  })
  const contentW = Math.max(...scaledPieces.map((sc) => panelDims(sc, frameW, matW).w))
  positions.forEach((pos) => {
    const { w: panelW } = panelDims(pos.scaled, frameW, matW)
    pos.x = Math.round((contentW - panelW) / 2)
  })
  return { positions, contentW, contentH: cursorY - gap }
}

// Shared by Grid and Pyramid: lays out each row independently, tight, then
// stacks the rows and centers each one horizontally within the widest row.
function layoutRowsArrangement(rows, frameW, matW, gap) {
  const rowLayouts = rows.map((rowPieces) => {
    let cursorX = 0
    let rowH = 0
    const rowPositions = rowPieces.map((sc) => {
      const { w: panelW, h: panelH } = panelDims(sc, frameW, matW)
      const pos = { scaled: sc, x: cursorX, y: 0 }
      cursorX += panelW + gap
      rowH = Math.max(rowH, panelH)
      return pos
    })
    return { rowPositions, rowW: cursorX - gap, rowH }
  })
  const maxRowW = Math.max(...rowLayouts.map((r) => r.rowW))
  const positions = []
  let cursorY = 0
  rowLayouts.forEach(({ rowPositions, rowW, rowH }) => {
    const xOffset = Math.round((maxRowW - rowW) / 2)
    rowPositions.forEach((pos) => {
      pos.x += xOffset
      pos.y = cursorY
      positions.push(pos)
    })
    cursorY += rowH + gap
  })
  return { positions, contentW: maxRowW, contentH: cursorY - gap }
}

function splitIntoRows(items, rowSizes) {
  const rows = []
  let idx = 0
  rowSizes.forEach((size) => {
    rows.push(items.slice(idx, idx + size))
    idx += size
  })
  return rows
}

// 2x2 for up to 4 pieces (last row may have 1); "2+3" for the 5-piece cap.
function gridRowSizes(n) {
  if (n <= 4) {
    const sizes = []
    for (let remaining = n; remaining > 0; remaining -= 2) sizes.push(Math.min(2, remaining))
    return sizes
  }
  return [2, 3]
}

// Rows of 1, 2, 3, ... from the top, widening toward the base — a
// reasonable "pyramid" gallery-wall reading without being fussy about it
// (this is a starting point; free arrangement can reshape it further).
function pyramidRowSizes(n) {
  const sizes = []
  let remaining = n
  let rowSize = 1
  while (remaining > 0) {
    const take = Math.min(rowSize, remaining)
    sizes.push(take)
    remaining -= take
    rowSize += 1
  }
  return sizes
}

// One large hero, centered, with up to 4 smaller pieces anchored just
// outside its corners.
function layoutClusterArrangement(scaledPieces, frameW, matW, gap) {
  const [hero, ...satellites] = scaledPieces
  const heroDims = panelDims(hero, frameW, matW)
  const positions = [{ scaled: hero, x: 0, y: 0 }]
  const corners = [
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 1 },
  ]
  satellites.slice(0, 4).forEach((sc, i) => {
    const { w: satW, h: satH } = panelDims(sc, frameW, matW)
    const { dx, dy } = corners[i]
    const x = dx < 0 ? -satW - gap : heroDims.w + gap
    const y = dy < 0 ? -satH - gap : heroDims.h + gap
    positions.push({ scaled: sc, x, y })
  })
  const minX = Math.min(...positions.map((p) => p.x))
  const minY = Math.min(...positions.map((p) => p.y))
  const maxX = Math.max(...positions.map((p) => p.x + panelDims(p.scaled, frameW, matW).w))
  const maxY = Math.max(...positions.map((p) => p.y + panelDims(p.scaled, frameW, matW).h))
  positions.forEach((p) => {
    p.x -= minX
    p.y -= minY
  })
  return { positions, contentW: maxX - minX, contentH: maxY - minY }
}

// Builds the scaled-piece array for a layout (most share one target height;
// Cluster gives its hero more and its satellites less), then arranges them.
// Returns the arrangement's bounding size plus the margin this arrangement
// needs (shadow-derived) — the minimum breathing room fitCanvas will use.
function layoutPieces({ ready, layout, frameW, matW, targetH, s }) {
  const staggerOffset = Math.round(40 * s)

  const scaledPieces =
    layout === 'cluster' && ready.length > 1
      ? ready.map((p, i) => scalePiece(p, i === 0 ? targetH * 1.55 : targetH * 0.7))
      : ready.map((p) => scalePiece(p, targetH))

  const { margin, gap } = marginAndGap(scaledPieces, s)

  let arrangement
  if (layout === 'cluster' && ready.length > 1) {
    arrangement = layoutClusterArrangement(scaledPieces, frameW, matW, gap)
  } else if (layout === 'grid' && ready.length > 1) {
    arrangement = layoutRowsArrangement(splitIntoRows(scaledPieces, gridRowSizes(scaledPieces.length)), frameW, matW, gap)
  } else if (layout === 'pyramid' && ready.length > 1) {
    arrangement = layoutRowsArrangement(
      splitIntoRows(scaledPieces, pyramidRowSizes(scaledPieces.length)),
      frameW,
      matW,
      gap,
    )
  } else if (layout === 'column' && ready.length > 1) {
    arrangement = layoutColumnArrangement(scaledPieces, frameW, matW, gap)
  } else {
    // Row, or Salon-stagger, or any preset with only 1 piece (nothing to
    // arrange around/into — a single centered panel either way).
    const yOffsets = layout === 'stagger' ? scaledPieces.map((_, i) => (i % 2 !== 0 ? staggerOffset : 0)) : null
    arrangement = layoutRowArrangement(scaledPieces, frameW, matW, gap, yOffsets)
  }

  return { ...arrangement, margin }
}

// Fits a tight content box into a canvas of the given aspect ratio (or the
// content's own aspect ratio, in Free mode), respecting a minimum margin on
// whichever axis is tighter, and centering the content on the other axis.
function fitCanvas(contentW, contentH, aspectRatio, minMargin) {
  if (!aspectRatio) {
    return {
      totalW: Math.round(contentW + minMargin * 2),
      totalH: Math.round(contentH + minMargin * 2),
      offsetX: minMargin,
      offsetY: minMargin,
    }
  }
  const neededW = contentW + minMargin * 2
  const neededH = contentH + minMargin * 2
  const totalH = Math.round(Math.max(neededH, neededW / aspectRatio))
  const totalW = Math.round(totalH * aspectRatio)
  return {
    totalW,
    totalH,
    offsetX: Math.round((totalW - contentW) / 2),
    offsetY: Math.round((totalH - contentH) / 2),
  }
}

// v2 PRD §3.3 free arrangement — `manualPositions` is a map of piece id ->
// { x, y, scale }, where x/y are the panel's CENTER as a fraction (0-1) of
// the canvas and scale is a multiplier on top of whatever height the preset
// assigned that piece. Storing it this way (not absolute pixels) is what
// lets a manually-dragged arrangement survive switching between the low-res
// preview and a much larger export render untouched. `zOrder` is a draw
// order (back to front) of piece ids; pieces without a manual position or a
// zOrder entry keep their preset position/order.
export function computeCompositeDims({
  pieces,
  frameWidthPct,
  matWidthPct,
  layout,
  targetH = BASE_TARGET_H,
  aspectRatio = null,
  manualPositions = null,
  zOrder = null,
  presentationStyle = 'framed-mat',
  paperEdge = 'border',
}) {
  const ready = pieces.filter((p) => p.rectified)
  if (!ready.length) return null
  const s = targetH / BASE_TARGET_H
  const rawFrameW = Math.round(18 * s * (Math.max(100, frameWidthPct) / 100))
  const rawMatW = Math.round(34 * s * (matWidthPct / 100))
  const { frameW, matW } = effectiveDimsForStyle(presentationStyle, rawFrameW, rawMatW, paperEdge)

  const { positions, contentW, contentH, margin } = layoutPieces({ ready, layout, frameW, matW, targetH, s })
  const { totalW, totalH, offsetX, offsetY } = fitCanvas(contentW, contentH, aspectRatio, margin)

  // Fold the preset's own offset in now, and splice in absolute pixel
  // positions for any piece the user has manually dragged/scaled.
  let finalPositions = positions.map((pos) => {
    const override = manualPositions?.[pos.scaled.p.id]
    if (!override) {
      return { scaled: pos.scaled, x: offsetX + pos.x, y: offsetY + pos.y }
    }
    const scaledOverride = scalePiece(pos.scaled.p, pos.scaled.h * (override.scale ?? 1))
    const { w: panelW, h: panelH } = panelDims(scaledOverride, frameW, matW)
    return {
      scaled: scaledOverride,
      x: override.x * totalW - panelW / 2,
      y: override.y * totalH - panelH / 2,
    }
  })

  if (zOrder) {
    const orderIndex = new Map(zOrder.map((id, i) => [id, i]))
    finalPositions = [...finalPositions].sort(
      (a, b) => (orderIndex.get(a.scaled.p.id) ?? -1) - (orderIndex.get(b.scaled.p.id) ?? -1),
    )
  }

  return { positions: finalPositions, frameW, matW, totalW, totalH }
}

export function renderScene({
  pieces,
  frameWidthPct,
  matWidthPct,
  layout,
  wallColor,
  frameColor,
  matColor = '#faf8f4',
  textureKey,
  glaze = 'matte',
  targetH = BASE_TARGET_H,
  aspectRatio = null,
  manualPositions = null,
  zOrder = null,
  presentationStyle = 'framed-mat',
  paperEdge = 'border',
  backgroundMode = 'wall',
  wallTextureKey = null,
  flatColor = '#e5e2dc',
  blurRadius = 40,
  dimAmount = 0.5,
  blurSourceId = null,
  lightStyle = 'museum',
  colorTemp = 0,
  intensity = 1,
  filters = DEFAULT_FILTERS,
  artTexture = 'none',
  artTextureIntensity = 1,
  frameTextureIntensity = 1,
  wallTextureIntensity = 1,
}) {
  const lighting = makeLighting(lightStyle, colorTemp, intensity)
  const surfaceI = sceneIntensity(lighting)
  const litWall = litWallColor(wallColor, colorTemp, lighting)
  const litFrame = applyLighting(frameColor, colorTemp, surfaceI)
  const litMat = applyLighting(matColor, colorTemp, surfaceI)

  const dims = computeCompositeDims({
    pieces,
    frameWidthPct,
    matWidthPct,
    layout,
    targetH,
    aspectRatio,
    manualPositions,
    zOrder,
    presentationStyle,
    paperEdge,
  })
  if (!dims) return null
  const { positions, frameW, matW, totalW, totalH } = dims

  const canvas = document.createElement('canvas')
  canvas.width = totalW
  canvas.height = totalH
  const ctx = canvas.getContext('2d')
  const blurSourceImage =
    backgroundMode === 'blurred'
      ? (pieces.find((p) => p.id === blurSourceId && p.rectified) || pieces.find((p) => p.rectified))?.rectified
      : null
  drawBackground(ctx, totalW, totalH, {
    backgroundMode,
    wallColor: litWall,
    wallTextureCanvas: wallTextureKey ? getCachedWallTexture(wallTextureKey) : null,
    flatColor: applyLighting(flatColor, colorTemp, surfaceI),
    blurSourceImage,
    blurRadius,
    dimAmount,
    lighting,
    wallTextureIntensity,
  })
  if (backgroundMode === 'wall' && lighting.style === 'picture') {
    drawPictureLightCones(ctx, positions, frameW, matW, intensity, totalW, totalH)
  }

  positions.forEach(({ scaled: s, x, y }) => {
    const artCanvas = document.createElement('canvas')
    artCanvas.width = Math.round(s.w)
    artCanvas.height = Math.round(s.h)
    artCanvas.getContext('2d').drawImage(s.p.rectified, 0, 0, artCanvas.width, artCanvas.height)
    const seed = Math.round(x * 7 + y * 13) + 1
    drawPresentedPiece(
      ctx,
      x,
      y,
      artCanvas,
      frameW,
      matW,
      litFrame,
      litMat,
      textureKey,
      litWall,
      glaze,
      presentationStyle,
      seed,
      false,
      paperEdge,
      lighting,
      artTexture,
      artTextureIntensity,
      frameTextureIntensity,
    )
  })

  applyCompositeFilters(canvas, filters, targetH / BASE_TARGET_H)
  return canvas
}

// Renders the wall + every piece except `excludeId`. Used to build a
// cached backdrop once at the start of a drag: the expensive per-piece
// frame/texture generation for the OTHER pieces doesn't need to be redone
// on every pointermove while only one piece is actually moving.
export function renderSceneExcluding({
  pieces,
  frameWidthPct,
  matWidthPct,
  layout,
  wallColor,
  frameColor,
  matColor = '#faf8f4',
  textureKey,
  glaze = 'matte',
  targetH = BASE_TARGET_H,
  aspectRatio = null,
  manualPositions = null,
  zOrder = null,
  presentationStyle = 'framed-mat',
  paperEdge = 'border',
  backgroundMode = 'wall',
  wallTextureKey = null,
  flatColor = '#e5e2dc',
  blurRadius = 40,
  dimAmount = 0.5,
  blurSourceId = null,
  lightStyle = 'museum',
  colorTemp = 0,
  intensity = 1,
  artTexture = 'none',
  artTextureIntensity = 1,
  frameTextureIntensity = 1,
  wallTextureIntensity = 1,
  excludeId,
}) {
  const lighting = makeLighting(lightStyle, colorTemp, intensity)
  const surfaceI = sceneIntensity(lighting)
  const litWall = litWallColor(wallColor, colorTemp, lighting)
  const litFrame = applyLighting(frameColor, colorTemp, surfaceI)
  const litMat = applyLighting(matColor, colorTemp, surfaceI)

  const dims = computeCompositeDims({
    pieces,
    frameWidthPct,
    matWidthPct,
    layout,
    targetH,
    aspectRatio,
    manualPositions,
    zOrder,
    presentationStyle,
    paperEdge,
  })
  if (!dims) return null
  const { positions, frameW, matW, totalW, totalH } = dims

  const canvas = document.createElement('canvas')
  canvas.width = totalW
  canvas.height = totalH
  const ctx = canvas.getContext('2d')
  const blurSourceImage =
    backgroundMode === 'blurred'
      ? (pieces.find((p) => p.id === blurSourceId && p.rectified) || pieces.find((p) => p.rectified))?.rectified
      : null
  drawBackground(ctx, totalW, totalH, {
    backgroundMode,
    wallColor: litWall,
    wallTextureCanvas: wallTextureKey ? getCachedWallTexture(wallTextureKey) : null,
    flatColor: applyLighting(flatColor, colorTemp, surfaceI),
    blurSourceImage,
    blurRadius,
    dimAmount,
    lighting,
    wallTextureIntensity,
  })
  if (backgroundMode === 'wall' && lighting.style === 'picture') {
    drawPictureLightCones(ctx, positions, frameW, matW, intensity, totalW, totalH)
  }

  positions.forEach(({ scaled: s, x, y }) => {
    if (s.p.id === excludeId) return
    const artCanvas = document.createElement('canvas')
    artCanvas.width = Math.round(s.w)
    artCanvas.height = Math.round(s.h)
    artCanvas.getContext('2d').drawImage(s.p.rectified, 0, 0, artCanvas.width, artCanvas.height)
    const seed = Math.round(x * 7 + y * 13) + 1
    drawPresentedPiece(
      ctx,
      x,
      y,
      artCanvas,
      frameW,
      matW,
      litFrame,
      litMat,
      textureKey,
      litWall,
      glaze,
      presentationStyle,
      seed,
      false,
      paperEdge,
      lighting,
      artTexture,
      artTextureIntensity,
      frameTextureIntensity,
    )
  })

  return canvas
}

// v2 PRD §3.1 — Output export presets.
export const EXPORT_MODES = [
  { key: 'social', label: 'Social' },
  { key: 'hires', label: 'Hi-res' },
  { key: 'native', label: 'Native' },
  { key: 'artwork', label: 'Artwork only' },
]

// ~iOS Safari canvas-area limit, shared with the rectification cap.
const EXPORT_PIXEL_CAP = 16.7e6

// The whole composite scales linearly with targetH (every constant in
// computeCompositeDims is expressed as targetH * a fixed ratio), so one
// cheap dry run (no pixel drawing) at a reference targetH is enough to
// solve exactly for the targetH that makes the render's long edge equal
// `desiredLongEdge` — no iteration needed.
function resolveTargetHForLongEdge(sceneArgs, desiredLongEdge) {
  const ref = computeCompositeDims({ ...sceneArgs, targetH: BASE_TARGET_H })
  if (!ref) return BASE_TARGET_H
  const refLong = Math.max(ref.totalW, ref.totalH)
  return BASE_TARGET_H * (desiredLongEdge / refLong)
}

// Instagram-style anchor: short edge fixed at 1080px, long edge derived
// from the aspect ratio. Reproduces the v2 PRD's own examples exactly
// (4:5 -> 1080x1350, 9:16 -> 1080x1920) and extrapolates the same way
// for the other ratios.
function socialLongEdgeForRatio(ratio) {
  const SHORT_EDGE = 1080
  return ratio <= 1 ? SHORT_EDGE / ratio : SHORT_EDGE * ratio
}

// Resolves the exact targetH to pass to renderScene for a given export
// mode, applying the shared pixel-area cap where a mode could otherwise
// exceed it. Returns { targetH, capped } so the caller can tell the user
// when a request (e.g. Native on a very large piece) had to be capped.
export function resolveExportTargetH({ pieces, frameWidthPct, matWidthPct, layout, aspectRatio, mode, presentationStyle, paperEdge }) {
  const sceneArgs = { pieces, frameWidthPct, matWidthPct, layout, aspectRatio, presentationStyle, paperEdge }
  const applyPixelCap = (targetH) => {
    const dims = computeCompositeDims({ ...sceneArgs, targetH })
    if (!dims) return { targetH, capped: false }
    const pixels = dims.totalW * dims.totalH
    if (pixels <= EXPORT_PIXEL_CAP) return { targetH, capped: false }
    const areaScale = Math.sqrt(EXPORT_PIXEL_CAP / pixels)
    return { targetH: targetH * areaScale, capped: true }
  }

  if (mode === 'hires') {
    return applyPixelCap(resolveTargetHForLongEdge(sceneArgs, 4000))
  }
  if (mode === 'native') {
    const ready = pieces.filter((p) => p.rectified)
    // Heights are normalized across a series (v1 PRD §5.9): the tallest
    // piece is the one that gets to render at its true native height, so
    // that's the floor "native" means here — the others already share
    // that display height by design.
    const targetH = ready.length ? Math.max(...ready.map((p) => p.rectified.height)) : BASE_TARGET_H
    return applyPixelCap(targetH)
  }
  // 'social' (and fallback default)
  const ref = computeCompositeDims({ ...sceneArgs, targetH: BASE_TARGET_H })
  const naturalRatio = ref ? ref.totalW / ref.totalH : 1
  const desiredLongEdge = socialLongEdgeForRatio(aspectRatio ?? naturalRatio)
  return { targetH: resolveTargetHForLongEdge(sceneArgs, desiredLongEdge), capped: false }
}

// Renders the composite for a given export mode in one call — resolves the
// correct resolution, then renders at it. Returns { canvas, capped }.
export function renderExportScene({
  pieces,
  frameWidthPct,
  matWidthPct,
  layout,
  wallColor,
  frameColor,
  matColor,
  textureKey,
  glaze,
  aspectRatio,
  mode,
  manualPositions,
  zOrder,
  presentationStyle,
  paperEdge,
  backgroundMode,
  wallTextureKey,
  flatColor,
  blurRadius,
  dimAmount,
  blurSourceId,
  lightStyle,
  colorTemp,
  intensity,
  filters = DEFAULT_FILTERS,
  artTexture = 'none',
  artTextureIntensity = 1,
  frameTextureIntensity = 1,
  wallTextureIntensity = 1,
}) {
  const { targetH, capped } = resolveExportTargetH({
    pieces,
    frameWidthPct,
    matWidthPct,
    layout,
    aspectRatio,
    mode,
    presentationStyle,
    paperEdge,
  })
  const canvas = renderScene({
    pieces,
    frameWidthPct,
    matWidthPct,
    layout,
    wallColor,
    frameColor,
    matColor,
    textureKey,
    glaze,
    aspectRatio,
    targetH,
    manualPositions,
    zOrder,
    presentationStyle,
    paperEdge,
    backgroundMode,
    wallTextureKey,
    flatColor,
    blurRadius,
    dimAmount,
    blurSourceId,
    lightStyle,
    colorTemp,
    intensity,
    filters,
    artTexture,
    artTextureIntensity,
    frameTextureIntensity,
    wallTextureIntensity,
  })
  return { canvas, capped }
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

// "Artwork only" export mode: no frame/wall/effects, just each piece's own
// rectified canvas (already at its native resolution — see rectifyPiece),
// for the website gallery and archiving. Multiple pieces come out as
// multiple files: one navigator.share() call carrying all of them where
// supported (Share API Level 2 accepts multiple files in a single call —
// important since iOS only reliably honours one share()/gesture), or one
// synchronous anchor-download per file otherwise.
export async function downloadArtworkOnly(pieces, baseFilename = 'melbourne-artstudio-artwork') {
  const ready = pieces.filter((p) => p.rectified)
  if (!ready.length) return

  const files = ready.map((p, i) => {
    const blob = dataUrlToBlob(p.rectified.toDataURL('image/png'))
    const filename = ready.length > 1 ? `${baseFilename}-${i + 1}.png` : `${baseFilename}.png`
    return new File([blob], filename, { type: 'image/png' })
  })

  if (navigator.canShare && navigator.share && navigator.canShare({ files })) {
    try {
      await navigator.share({ files })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return
      // fall through to the anchor-download path below
    }
  }

  files.forEach((file) => {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.download = file.name
    link.href = url
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  })
}
