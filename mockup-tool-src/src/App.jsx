import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ColorPicker } from './ColorPicker.jsx'
import { applyLighting, extractPalette, LIGHT_STYLES, MAT_PRESETS, rgbToHex, WALL_TONES } from './engine/color.js'
import { applyCompositeFilters, DEFAULT_FILTERS, FILTER_PRESETS, FILTER_SLIDERS, filtersMatch } from './engine/filters.js'
import { defaultCorners, rectifyPiece, sortCornersClockwise } from './engine/geometry.js'
import {
  ASPECT_RATIOS,
  computeCompositeDims,
  downloadArtworkOnly,
  downloadCanvasPng,
  drawPresentedPiece,
  EXPORT_MODES,
  LAYOUT_OPTIONS,
  makeLighting,
  PRESENTATION_STYLES,
  renderExportScene,
  renderScene,
  renderSceneExcluding,
} from './engine/scene.js'
import { ART_TEXTURE_OPTIONS, loadArtSurfaceTexture, loadTextures, loadWallTexture, TEXTURE_OPTIONS, WALL_TEXTURE_OPTIONS } from './engine/textures.js'

const MAX_PIECES = 5
const MAX_DISPLAY = 560
const FRAME_PRESETS = [
  { key: 'dark', label: 'Dark', hex: '#1C1B1A' },
  { key: 'natural', label: 'Natural wood', hex: '#8A6242' },
  { key: 'white', label: 'White', hex: '#F2EFE8' },
]
// Dark pairs with the open-grain black veneer; White uses ash tinted
// light (PRD Appendix A). Everything else, including custom colours, starts on oak.
const defaultGrainForFramePreset = (presetKey) => {
  if (presetKey === 'dark') return 'black'
  if (presetKey === 'white') return 'ash'
  return 'oak'
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function imageToCanvas(img) {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d').drawImage(img, 0, 0)
  return canvas
}

function drawCornerCanvas(canvas, piece) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(piece.img, 0, 0, canvas.width, canvas.height)
  // The outline is drawn in sorted (TL->TR->BR->BL) order so it always
  // traces a simple quadrilateral, even if the handles themselves were
  // dragged past each other and are no longer in that order in state.
  const outline = sortCornersClockwise(piece.corners)
  ctx.strokeStyle = 'rgba(79,70,229,0.95)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(outline[0].x, outline[0].y)
  for (let i = 1; i < 4; i++) ctx.lineTo(outline[i].x, outline[i].y)
  ctx.closePath()
  ctx.stroke()
  piece.corners.forEach((pt) => {
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 22, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(79,70,229,0.18)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 13, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(20,17,15,0.85)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 13, 0, Math.PI * 2)
    ctx.strokeStyle = '#4F46E5'
    ctx.lineWidth = 2.5
    ctx.stroke()
  })
}

function CornerEditor({ piece, onCornersChange }) {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !piece) return
    canvas.width = piece.displayW
    canvas.height = piece.displayH
    drawCornerCanvas(canvas, piece)
  }, [piece])

  const pointerPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
      sx,
      sy,
    }
  }

  const onPointerDown = (e) => {
    const canvas = canvasRef.current
    const { x, y, sx, sy } = pointerPos(e, canvas)
    let closest = -1
    let closestDist = Infinity
    piece.corners.forEach((c, i) => {
      const d = Math.hypot(c.x - x, c.y - y)
      if (d < closestDist) {
        closestDist = d
        closest = i
      }
    })
    const minTouchPx = 48 * Math.max(sx, sy)
    if (closestDist < minTouchPx) {
      dragRef.current = closest
      canvas.setPointerCapture(e.pointerId)
      e.preventDefault()
    }
  }

  const onPointerMove = (e) => {
    if (dragRef.current === null) return
    e.preventDefault()
    const canvas = canvasRef.current
    const { x, y } = pointerPos(e, canvas)
    const next = piece.corners.map((c, i) =>
      i === dragRef.current
        ? { x: Math.max(0, Math.min(canvas.width, x)), y: Math.max(0, Math.min(canvas.height, y)) }
        : c,
    )
    onCornersChange(next)
    drawCornerCanvas(canvas, { ...piece, corners: next })
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  return (
    <div className="corner-wrap">
      <canvas
        ref={canvasRef}
        className="corner-canvas"
        width={piece.displayW}
        height={piece.displayH}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="corner-hint">
        Drag the four points onto the corners of the artwork itself. Order doesn&apos;t matter — just match each
        point to the nearest true corner.
      </div>
    </div>
  )
}

export default function App() {
  const fileInputRef = useRef(null)
  const compositeRef = useRef(null)
  const renderRaf = useRef(0)
  const paintGen = useRef(0)
  const unfilteredSceneRef = useRef(null)
  const unfilteredArgsRef = useRef(null)

  const [pieces, setPieces] = useState([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [frameColor, setFrameColor] = useState(FRAME_PRESETS[0].hex)
  const [customColor, setCustomColor] = useState(FRAME_PRESETS[0].hex)
  const [selectedFramePreset, setSelectedFramePreset] = useState(FRAME_PRESETS[0].key)
  const [matColor, setMatColor] = useState(MAT_PRESETS[0].hex)
  const [customMatColor, setCustomMatColor] = useState(MAT_PRESETS[0].hex)
  const [selectedMatPreset, setSelectedMatPreset] = useState(MAT_PRESETS[0].key)
  const [frameWidthPct, setFrameWidthPct] = useState(100)
  const [matWidthPct, setMatWidthPct] = useState(100)
  const [wallColor, setWallColor] = useState(WALL_TONES[0].hex)
  // v2 PRD §3.6 — background mode. 'wall' (photographed texture tinted by
  // wallColor, or the procedural fallback when wallTextureKey is null),
  // 'flat' (solid colour backdrop), or 'blurred' (a piece's own artwork,
  // scaled to cover and heavily blurred, behind the sharp pieces).
  const [backgroundMode, setBackgroundMode] = useState('wall')
  const [wallTextureKey, setWallTextureKey] = useState(null)
  const [flatColor, setFlatColor] = useState('#e5e2dc')
  const [blurRadius, setBlurRadius] = useState(40)
  const [dimAmount, setDimAmount] = useState(0.5)
  const [blurSourceId, setBlurSourceId] = useState(null)
  const [wallTextureVersion, setWallTextureVersion] = useState(0)
  // v2 PRD §3.7 — scene lighting. Defaults match v1: even museum light,
  // neutral temperature, intensity 1.
  const [lightStyle, setLightStyle] = useState('museum')
  const [colorTemp, setColorTemp] = useState(0)
  const [intensity, setIntensity] = useState(1)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [layout, setLayout] = useState('row')
  // v2 PRD §3.3 free arrangement: manual per-piece overrides on top of
  // whichever layout preset is selected. manualPositions maps piece id ->
  // { x, y, scale } (x/y are the panel's center as a 0-1 fraction of the
  // canvas); zOrder is a back-to-front draw order of piece ids. Both reset
  // whenever the layout preset itself changes (a different named shape) or
  // via the explicit "Reset arrangement" button.
  const [manualPositions, setManualPositions] = useState({})
  const [zOrder, setZOrder] = useState([])
  const [selectedPieceId, setSelectedPieceId] = useState(null)
  const dragRef = useRef(null)
  const [aspectRatioKey, setAspectRatioKey] = useState('4:5')
  const [presentationStyle, setPresentationStyle] = useState('framed-mat')
  const [paperEdge, setPaperEdge] = useState('border')
  const [artTexture, setArtTexture] = useState('none')
  const [artTextureVersion, setArtTextureVersion] = useState(0)
  // v2 PRD §3.13 — per-surface texture intensity: 1 = the original tuned
  // look, 0 = texture off, 2 = doubled. Independent of lighting intensity.
  const [artTextureIntensity, setArtTextureIntensity] = useState(1)
  const [frameTextureIntensity, setFrameTextureIntensity] = useState(1)
  const [wallTextureIntensity, setWallTextureIntensity] = useState(1)
  const [exportMode, setExportMode] = useState('social')
  const [capNotice, setCapNotice] = useState('')
  const [textureKey, setTextureKey] = useState(defaultGrainForFramePreset(FRAME_PRESETS[0].key))
  const [glaze, setGlaze] = useState('matte')
  const [texturesReady, setTexturesReady] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [editingCorners, setEditingCorners] = useState(true)
  const [theme, setTheme] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  const activePiece = pieces[activeIndex] || null
  const allRectified = pieces.length > 0 && pieces.every((p) => p.rectified)
  const textureLabel = TEXTURE_OPTIONS.find((o) => o.key === textureKey)?.short || 'oak'
  const wallLabel = WALL_TONES.find((w) => w.hex === wallColor)?.label || 'Custom'
  const artworkPalette = useMemo(() => {
    const hexes = []
    for (const p of pieces) {
      const colors = p.palette || (p.rectified ? extractPalette(p.rectified, 5) : [])
      for (const c of colors) {
        const hex = rgbToHex(c)
        if (!hexes.includes(hex)) hexes.push(hex)
      }
    }
    return hexes.slice(0, 6)
  }, [pieces])
  const aspectRatio = ASPECT_RATIOS.find((a) => a.key === aspectRatioKey)?.ratio ?? null

  useEffect(() => {
    loadTextures().then(() => setTexturesReady(true))
  }, [])

  useEffect(() => {
    if (!TEXTURE_OPTIONS.some((o) => o.key === textureKey)) {
      setTextureKey('oak')
    }
  }, [textureKey])

  // Wall textures are lazy-loaded (unlike the small eager frame textures) —
  // kick off the load the first time a texture key is actually selected,
  // then force a repaint once it resolves so the tinted texture appears
  // instead of staying on the procedural fallback.
  useEffect(() => {
    if (backgroundMode !== 'wall' || !wallTextureKey) return
    if (!WALL_TEXTURE_OPTIONS.some((o) => o.key === wallTextureKey)) {
      setWallTextureKey(null)
      return
    }
    let cancelled = false
    loadWallTexture(wallTextureKey).then(() => {
      if (!cancelled) setWallTextureVersion((v) => v + 1)
    })
    return () => {
      cancelled = true
    }
  }, [backgroundMode, wallTextureKey])

  useEffect(() => {
    if (!ART_TEXTURE_OPTIONS.some((o) => o.key === artTexture)) {
      setArtTexture('none')
      return
    }
    let cancelled = false
    loadArtSurfaceTexture(artTexture).then(() => {
      if (!cancelled) setArtTextureVersion((v) => v + 1)
    })
    return () => {
      cancelled = true
    }
  }, [artTexture])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const addFiles = async (fileList) => {
    const remaining = MAX_PIECES - pieces.length
    const files = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, remaining)
    const nextPieces = [...pieces]
    for (const file of files) {
      const img = await loadImageFromFile(file)
      const natCanvas = imageToCanvas(img)
      const scale = Math.min(1, MAX_DISPLAY / Math.max(img.naturalWidth, img.naturalHeight))
      const dw = Math.round(img.naturalWidth * scale)
      const dh = Math.round(img.naturalHeight * scale)
      nextPieces.push({
        id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6),
        img,
        natCanvas,
        thumbUrl: natCanvas.toDataURL('image/jpeg', 0.6),
        scale,
        displayW: dw,
        displayH: dh,
        corners: defaultCorners(dw, dh),
        rectified: null,
        palette: null,
      })
    }
    if (nextPieces.length === pieces.length) return
    setPieces(nextPieces)
    setActiveIndex(nextPieces.length - 1)
    setEditingCorners(true)
    // Manual positions are stored as a fraction of the canvas, and the
    // canvas is fit to however many pieces there are — a fraction tuned
    // for a 5-piece canvas can land way off-canvas once there's only 1
    // piece left. Simplest correct fix: any change in piece count starts
    // free arrangement fresh, same as switching layout presets already does.
    setManualPositions({})
    setZOrder([])
    setSelectedPieceId(null)
  }

  const addFilesRef = useRef(addFiles)
  addFilesRef.current = addFiles
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__addMockupFiles = (files) => addFilesRef.current(files)
    return () => {
      delete window.__addMockupFiles
    }
  }, [])

  const removePiece = (index, e) => {
    e.stopPropagation()
    const next = pieces.filter((_, i) => i !== index)
    setPieces(next)
    setActiveIndex(next.length ? Math.min(index, next.length - 1) : -1)
    setEditingCorners(true)
    // See addFiles: any change in piece count invalidates canvas-relative
    // manual positions, so start free arrangement fresh.
    setManualPositions({})
    setZOrder([])
    setSelectedPieceId(null)
  }

  const resetCorners = () => {
    if (!activePiece) return
    const corners = defaultCorners(activePiece.displayW, activePiece.displayH)
    setPieces((prev) => prev.map((p, i) => (i === activeIndex ? { ...p, corners } : p)))
  }

  const straightenPiece = () => {
    if (!activePiece) return
    setRendering(true)
    requestAnimationFrame(() => {
      const rectified = rectifyPiece(activePiece.natCanvas, activePiece.corners, activePiece.scale)
      const palette = extractPalette(rectified, 5)
      const next = pieces.map((p, i) => (i === activeIndex ? { ...p, rectified, palette } : p))
      setPieces(next)
      setRendering(false)
      if (next.every((p) => p.rectified)) {
        setEditingCorners(false)
      } else {
        const nextDraft = next.findIndex((p) => !p.rectified)
        setActiveIndex(nextDraft)
        setEditingCorners(true)
      }
    })
  }

  const resetArrangement = () => {
    setManualPositions({})
    setZOrder([])
    setSelectedPieceId(null)
  }

  // Threshold within which a drag snaps to an alignment candidate, in CSS
  // display pixels regardless of the canvas's actual pixel resolution or
  // on-screen zoom — matches the v1 §5.1 "tolerance in CSS pixels" rule
  // used for the corner-drag handles.
  const SNAP_THRESHOLD_CSS_PX = 10

  // Snaps a dragged piece's CENTER coordinate along one axis, but checks
  // alignment at all three of the piece's own reference points (leading
  // edge, center, trailing edge) against the candidate list — not just its
  // center against theirs. Otherwise two panels of different sizes could
  // never snap edge-to-edge, only center-to-center. Returns the adjusted
  // center plus the candidate coordinate to draw as the snap indicator
  // (null when nothing was within threshold).
  const snapDimension = (centerRaw, halfSize, candidates, thresholdPx) => {
    let center = centerRaw
    let indicator = null
    let bestDist = thresholdPx
    ;[-halfSize, 0, halfSize].forEach((offset) => {
      const point = centerRaw + offset
      candidates.forEach((c) => {
        const d = Math.abs(point - c)
        if (d < bestDist) {
          bestDist = d
          center = c - offset
          indicator = c
        }
      })
    })
    return { center, indicator }
  }

  const pointerToCanvasXY = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy, sx, sy }
  }

  // Light rule-of-thirds + center grid while dragging, with the specific
  // line(s) a piece actually snapped to drawn in the accent colour. Purely
  // a drag-time visual aid — never part of the committed render.
  // Uses the 'difference' blend mode so the grid stays visible regardless
  // of wall tone or how light/dark the artwork under it is — a plain
  // translucent white (the first thing tried) all but disappeared against
  // the default cream wall.
  const drawAlignmentGrid = (ctx, w, h, snapX, snapY) => {
    ctx.save()
    ctx.globalCompositeOperation = 'difference'
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 1
    ;[1 / 3, 2 / 3].forEach((f) => {
      ctx.beginPath()
      ctx.moveTo(w * f, 0)
      ctx.lineTo(w * f, h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, h * f)
      ctx.lineTo(w, h * f)
      ctx.stroke()
    })
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.moveTo(w / 2, 0)
    ctx.lineTo(w / 2, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()

    ctx.restore()

    // The snap indicator itself is the app's own accent purple (matching
    // the corner-drag handles), drawn normally rather than difference-
    // blended so the brand colour reads correctly — with a soft white
    // halo underneath so it still shows up against a dark wall or a dark
    // patch of artwork.
    ctx.save()
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    if (snapX != null) {
      ctx.beginPath()
      ctx.moveTo(snapX, 0)
      ctx.lineTo(snapX, h)
      ctx.stroke()
    }
    if (snapY != null) {
      ctx.beginPath()
      ctx.moveTo(0, snapY)
      ctx.lineTo(w, snapY)
      ctx.stroke()
    }
    ctx.strokeStyle = '#4F46E5'
    ctx.lineWidth = 2
    if (snapX != null) {
      ctx.beginPath()
      ctx.moveTo(snapX, 0)
      ctx.lineTo(snapX, h)
      ctx.stroke()
    }
    if (snapY != null) {
      ctx.beginPath()
      ctx.moveTo(0, snapY)
      ctx.lineTo(w, snapY)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Repaints the composite canvas directly (no React state, no full scene
  // re-render) using the cached "everything except the dragged piece"
  // backdrop plus the dragged piece's own pre-rendered sprite. This is what
  // keeps dragging smooth — the expensive per-piece frame/texture
  // generation happened once at pointerdown, not on every pointermove.
  const paintDragFrame = () => {
    const drag = dragRef.current
    const canvas = compositeRef.current
    if (!drag || !canvas || !drag.latestPointer) return
    const { px, py } = drag.latestPointer

    let cx = px - drag.grabDx
    let cy = py - drag.grabDy

    const xCandidates = [drag.totalW / 2]
    const yCandidates = [drag.totalH / 2]
    drag.others.forEach((p) => {
      xCandidates.push(p.x, p.x + p.w / 2, p.x + p.w)
      yCandidates.push(p.y, p.y + p.h / 2, p.y + p.h)
    })
    const xResult = snapDimension(cx, drag.spriteW / 2, xCandidates, drag.thresholdCanvasPx)
    const yResult = snapDimension(cy, drag.spriteH / 2, yCandidates, drag.thresholdCanvasPx)
    cx = xResult.center
    cy = yResult.center
    const snapX = xResult.indicator
    const snapY = yResult.indicator

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(drag.othersCanvas, 0, 0)
    ctx.drawImage(drag.sprite, cx - drag.spriteW / 2, cy - drag.spriteH / 2)
    applyCompositeFilters(canvas, drag.filters, 1, 'preview')
    drawAlignmentGrid(ctx, drag.totalW, drag.totalH, snapX, snapY)

    drag.pending = { x: cx / drag.totalW, y: cy / drag.totalH }
  }

  const onCompositePointerDown = (e) => {
    const canvas = compositeRef.current
    if (!canvas) return
    const dims = computeCompositeDims({
      pieces,
      frameWidthPct,
      matWidthPct,
      layout,
      aspectRatio,
      manualPositions,
      zOrder,
      presentationStyle,
      paperEdge,
    })
    if (!dims) return
    const { x: px, y: py, sx } = pointerToCanvasXY(e, canvas)

    // Topmost first: dims.positions is already in back-to-front draw order.
    for (let i = dims.positions.length - 1; i >= 0; i--) {
      const pos = dims.positions[i]
      const w = pos.scaled.w + dims.frameW * 2 + dims.matW * 2
      const h = pos.scaled.h + dims.frameW * 2 + dims.matW * 2
      if (px >= pos.x && px <= pos.x + w && py >= pos.y && py <= pos.y + h) {
        const id = pos.scaled.p.id
        setSelectedPieceId(id)

        const lighting = makeLighting(lightStyle, colorTemp, intensity)
        const surfaceI = lightStyle === 'picture' ? 1 : intensity
        const litWall = applyLighting(wallColor, colorTemp, surfaceI * (1 - lighting.preset.wallDarken))
        const litFrame = applyLighting(frameColor, colorTemp, surfaceI)
        const litMat = applyLighting(matColor, colorTemp, surfaceI)

        const othersCanvas = renderSceneExcluding({
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
          artTexture,
          artTextureIntensity,
          frameTextureIntensity,
          wallTextureIntensity,
          excludeId: id,
        })

        const artCanvas = document.createElement('canvas')
        artCanvas.width = pos.scaled.w
        artCanvas.height = pos.scaled.h
        artCanvas.getContext('2d').drawImage(pos.scaled.p.rectified, 0, 0, artCanvas.width, artCanvas.height)
        const seed = Math.round(pos.x * 7 + pos.y * 13) + 1
        const sprite = document.createElement('canvas')
        sprite.width = Math.round(w)
        sprite.height = Math.round(h)
        drawPresentedPiece(
          sprite.getContext('2d'),
          0,
          0,
          artCanvas,
          dims.frameW,
          dims.matW,
          litFrame,
          litMat,
          textureKey,
          litWall,
          glaze,
          presentationStyle,
          seed,
          true, // skipShadow — this is a fast drag preview, not the final render
          paperEdge,
          lighting,
          artTexture,
          artTextureIntensity,
          frameTextureIntensity,
        )

        dragRef.current = {
          id,
          grabDx: px - (pos.x + w / 2),
          grabDy: py - (pos.y + h / 2),
          totalW: dims.totalW,
          totalH: dims.totalH,
          thresholdCanvasPx: SNAP_THRESHOLD_CSS_PX * sx,
          others: dims.positions
            .filter((p) => p.scaled.p.id !== id)
            .map((p) => ({
              x: p.x,
              y: p.y,
              w: p.scaled.w + dims.frameW * 2 + dims.matW * 2,
              h: p.scaled.h + dims.frameW * 2 + dims.matW * 2,
            })),
          othersCanvas,
          sprite,
          spriteW: sprite.width,
          spriteH: sprite.height,
          filters: { ...filters },
          latestPointer: { px, py },
          rafId: null,
          pending: null,
        }
        paintDragFrame()
        try {
          canvas.setPointerCapture(e.pointerId)
        } catch {
          /* no active pointer to capture (e.g. synthetic events) — drag still works via dragRef */
        }
        e.preventDefault()
        return
      }
    }
    // Clicked empty wall — deselect rather than leaving a stale selection.
    setSelectedPieceId(null)
  }

  const onCompositePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag) return
    const canvas = compositeRef.current
    if (!canvas) return
    e.preventDefault()
    const { x: px, y: py } = pointerToCanvasXY(e, canvas)
    drag.latestPointer = { px, py }
    if (drag.rafId) return
    drag.rafId = requestAnimationFrame(() => {
      drag.rafId = null
      paintDragFrame()
    })
  }

  const onCompositePointerUp = (e) => {
    const drag = dragRef.current
    if (drag) {
      if (drag.rafId) cancelAnimationFrame(drag.rafId)
      if (drag.pending) {
        const { x, y } = drag.pending
        setManualPositions((prev) => ({
          ...prev,
          [drag.id]: { x, y, scale: prev[drag.id]?.scale ?? 1 },
        }))
      } else {
        // No actual movement (e.g. a plain click) — manualPositions won't
        // change, so nothing would otherwise trigger a repaint, leaving the
        // last drag frame (with its alignment grid overlay) frozen on the
        // canvas. Force a clean repaint back to the normal render.
        paintComposite()
      }
      if (compositeRef.current) {
        try {
          compositeRef.current.releasePointerCapture(e.pointerId)
        } catch {
          /* already released */
        }
      }
    }
    dragRef.current = null
  }

  // Safety net: setPointerCapture should redirect pointerup/pointercancel to
  // the canvas even when the cursor ends up outside it, but capture can fail
  // silently (synthetic events, focus loss, releasing over browser chrome).
  // When that happens the canvas never gets its pointerup, dragRef is never
  // cleared, and the last drag frame — including its alignment-grid overlay —
  // stays frozen on screen indefinitely. Listening on window guarantees the
  // drag always gets finalized regardless of where the release lands.
  useEffect(() => {
    const handleWindowPointerUp = (e) => {
      if (dragRef.current) onCompositePointerUp(e)
    }
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerUp)
    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerUp)
    }
  })

  const bringForward = () => {
    if (!selectedPieceId) return
    setZOrder((prev) => {
      const order = prev.length ? [...prev] : pieces.map((p) => p.id)
      const idx = order.indexOf(selectedPieceId)
      if (idx === -1 || idx === order.length - 1) return order
      ;[order[idx], order[idx + 1]] = [order[idx + 1], order[idx]]
      return order
    })
  }

  const sendBackward = () => {
    if (!selectedPieceId) return
    setZOrder((prev) => {
      const order = prev.length ? [...prev] : pieces.map((p) => p.id)
      const idx = order.indexOf(selectedPieceId)
      if (idx <= 0) return order
      ;[order[idx], order[idx - 1]] = [order[idx - 1], order[idx]]
      return order
    })
  }

  const setSelectedPieceScale = (scale) => {
    if (!selectedPieceId) return
    setManualPositions((prev) => {
      const current = prev[selectedPieceId]
      if (current) return { ...prev, [selectedPieceId]: { ...current, scale } }
      // Not manually positioned yet — anchor it at its current preset
      // position so only scale changes, not position.
      const dims = computeCompositeDims({
        pieces,
        frameWidthPct,
        matWidthPct,
        layout,
        aspectRatio,
        manualPositions: prev,
        zOrder,
        presentationStyle,
        paperEdge,
      })
      const pos = dims?.positions.find((p) => p.scaled.p.id === selectedPieceId)
      if (!pos) return prev
      const w = pos.scaled.w + dims.frameW * 2 + dims.matW * 2
      const h = pos.scaled.h + dims.frameW * 2 + dims.matW * 2
      return {
        ...prev,
        [selectedPieceId]: {
          x: (pos.x + w / 2) / dims.totalW,
          y: (pos.y + h / 2) / dims.totalH,
          scale,
        },
      }
    })
  }

  const paintComposite = useCallback(() => {
    const canvas = compositeRef.current
    if (!canvas || !allRectified) return
    const gen = ++paintGen.current
    const sceneArgs = {
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
      manualPositions,
      zOrder,
      presentationStyle,
      paperEdge,
      artTexture,
      artTextureVersion,
      artTextureIntensity,
      frameTextureIntensity,
      wallTextureIntensity,
      backgroundMode,
      wallTextureKey,
      flatColor,
      blurRadius,
      dimAmount,
      blurSourceId,
      lightStyle,
      colorTemp,
      intensity,
      wallTextureVersion,
      texturesReady,
    }
    const prev = unfilteredArgsRef.current
    const sceneUnchanged =
      prev &&
      prev.pieces === sceneArgs.pieces &&
      prev.frameWidthPct === sceneArgs.frameWidthPct &&
      prev.matWidthPct === sceneArgs.matWidthPct &&
      prev.layout === sceneArgs.layout &&
      prev.wallColor === sceneArgs.wallColor &&
      prev.frameColor === sceneArgs.frameColor &&
      prev.matColor === sceneArgs.matColor &&
      prev.textureKey === sceneArgs.textureKey &&
      prev.glaze === sceneArgs.glaze &&
      prev.aspectRatio === sceneArgs.aspectRatio &&
      prev.manualPositions === sceneArgs.manualPositions &&
      prev.zOrder === sceneArgs.zOrder &&
      prev.presentationStyle === sceneArgs.presentationStyle &&
      prev.paperEdge === sceneArgs.paperEdge &&
      prev.artTexture === sceneArgs.artTexture &&
      prev.artTextureVersion === sceneArgs.artTextureVersion &&
      prev.artTextureIntensity === sceneArgs.artTextureIntensity &&
      prev.frameTextureIntensity === sceneArgs.frameTextureIntensity &&
      prev.wallTextureIntensity === sceneArgs.wallTextureIntensity &&
      prev.backgroundMode === sceneArgs.backgroundMode &&
      prev.wallTextureKey === sceneArgs.wallTextureKey &&
      prev.flatColor === sceneArgs.flatColor &&
      prev.blurRadius === sceneArgs.blurRadius &&
      prev.dimAmount === sceneArgs.dimAmount &&
      prev.blurSourceId === sceneArgs.blurSourceId &&
      prev.lightStyle === sceneArgs.lightStyle &&
      prev.colorTemp === sceneArgs.colorTemp &&
      prev.intensity === sceneArgs.intensity &&
      prev.wallTextureVersion === sceneArgs.wallTextureVersion &&
      prev.texturesReady === sceneArgs.texturesReady

    let base = unfilteredSceneRef.current
    if (!base || !sceneUnchanged) {
      base = renderScene({
        ...sceneArgs,
        filters: DEFAULT_FILTERS,
      })
      unfilteredSceneRef.current = base
      unfilteredArgsRef.current = sceneArgs
    }
    if (!base || gen !== paintGen.current) return
    if (canvas.width !== base.width || canvas.height !== base.height) {
      canvas.width = base.width
      canvas.height = base.height
    }
    const ctx = canvas.getContext('2d')
    ctx.drawImage(base, 0, 0)
    applyCompositeFilters(canvas, filters, 1, 'preview')
  }, [
    allRectified,
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
    manualPositions,
    zOrder,
    presentationStyle,
    paperEdge,
    artTexture,
    artTextureVersion,
    artTextureIntensity,
    frameTextureIntensity,
    wallTextureIntensity,
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
    wallTextureVersion,
    texturesReady,
  ])

  useEffect(() => {
    if (!allRectified) return
    cancelAnimationFrame(renderRaf.current)
    renderRaf.current = requestAnimationFrame(paintComposite)
    return () => cancelAnimationFrame(renderRaf.current)
    // editingCorners is a dependency (not just allRectified) because the
    // composite <canvas> is conditionally unmounted/remounted whenever the
    // corner-editor/wall view toggles (see showComposite below) — without
    // it, flipping back to the wall view after editing corners left a
    // freshly-mounted, never-painted canvas at its default 300x150 size.
  }, [allRectified, editingCorners, paintComposite, texturesReady])

  const downloadPng = (e) => {
    e.preventDefault()
    setCapNotice('')

    if (exportMode === 'artwork') {
      downloadArtworkOnly(pieces)
      return
    }

    const { canvas, capped } = renderExportScene({
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
      mode: exportMode,
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
      manualPositions,
      zOrder,
    })
    if (!canvas) return
    if (capped) {
      setCapNotice('Requested resolution exceeded the browser canvas limit — exported at the largest size it supports instead.')
    }
    downloadCanvasPng(canvas, `melbourne-artstudio-mockup-${exportMode}.png`)
  }

  const header = useMemo(() => {
    if (!pieces.length) {
      return {
        title: 'Start with a photo',
        sub: `Upload one to ${MAX_PIECES} photos of your traditional pieces to begin.`,
      }
    }
    if (!allRectified || editingCorners) {
      return {
        title: `Straighten piece ${activeIndex + 1} of ${pieces.length}`,
        sub: 'Drag each point onto the true edge of the artwork — ignore any existing frame in the photo.',
      }
    }
    return {
      title: 'Museum wall preview',
      sub: 'Adjust frame colour, width, and mat on the left. This updates live.',
    }
  }, [pieces.length, allRectified, activeIndex, editingCorners])

  const showComposite = allRectified && !editingCorners

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-lockup">
            <img
              className="brand-logo"
              src={`${import.meta.env.BASE_URL}branding/${theme === 'dark' ? 'magpie-dark' : 'magpie-light'}.svg`}
              alt="Melbourne ArtStudio"
            />
            <div>
              <div className="brand-mark">Melbourne ArtStudio</div>
              <div className="brand-sub">Artwork mockup tool</div>
            </div>
          </div>
          <button
            className="theme-toggle"
            type="button"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
          >
            <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`} aria-hidden="true" />
          </button>
        </div>

        <div className="steps">
          <div className="step">
            <div className="step-head">
              <span className="step-num">1</span>
              <span className="step-title">Upload artwork</span>
            </div>
            <div className="step-body">Photos, not scans, are fine. Up to {MAX_PIECES} pieces for a series mockup.</div>
            {pieces.length < MAX_PIECES && (
              <div
                className="dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  addFiles(e.dataTransfer.files)
                }}
              >
                <div className="dropzone-label">Click to choose files</div>
                <div className="dropzone-hint">JPG or PNG, up to {MAX_PIECES}. Nothing is uploaded to a server.</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/*"
                  multiple
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>
            )}
            <div className="thumbrow">
              {pieces.map((p, i) => (
                <div
                  key={p.id}
                  className={'thumb' + (i === activeIndex ? ' active' : '')}
                  onClick={() => {
                    setActiveIndex(i)
                    setEditingCorners(true)
                  }}
                >
                  <img src={p.thumbUrl} alt="" />
                  <span className="status">{p.rectified ? 'ready' : 'draft'}</span>
                  <button
                    type="button"
                    className="remove"
                    aria-label="Remove piece"
                    onClick={(e) => removePiece(i, e)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={'step' + (pieces.length ? '' : ' disabled')}>
            <div className="step-head">
              <span className="step-num">2</span>
              <span className="step-title">Straighten each piece</span>
            </div>
            <div className="step-body">
              Drag the four points onto the actual edges of the artwork. Auto-guess starts near the image edges.
            </div>
            <div className="btn-row">
              <button className="btn" type="button" onClick={resetCorners}>
                Reset
              </button>
              {allRectified && editingCorners && (
                <button className="btn" type="button" onClick={() => setEditingCorners(false)}>
                  Back to wall
                </button>
              )}
              <button className="btn btn-primary btn-full" type="button" onClick={straightenPiece}>
                Straighten this piece
              </button>
            </div>
          </div>

          <div className={'step' + (allRectified ? '' : ' disabled')}>
            <div className="step-head">
              <span className="step-num">3</span>
              <span className="step-title">Frame &amp; wall</span>
            </div>

            <div className="field">
              <label>
                Presentation{' '}
                <span className="value">
                  {PRESENTATION_STYLES.find((s) => s.key === presentationStyle)?.label}
                </span>
              </label>
              <div className="ratio-options">
                {PRESENTATION_STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={'ratio-opt' + (presentationStyle === s.key ? ' selected' : '')}
                    onClick={() => setPresentationStyle(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {(presentationStyle === 'unframed-paper' || presentationStyle === 'float-mount') && (
              <div className="field">
                <label>
                  Paper edge{' '}
                  <span className="value">{paperEdge === 'bleed' ? 'Full bleed' : 'Bordered'}</span>
                </label>
                <div className="layout-options">
                  <button
                    type="button"
                    className={'layout-opt' + (paperEdge === 'border' ? ' selected' : '')}
                    onClick={() => setPaperEdge('border')}
                  >
                    Bordered
                  </button>
                  <button
                    type="button"
                    className={'layout-opt' + (paperEdge === 'bleed' ? ' selected' : '')}
                    onClick={() => setPaperEdge('bleed')}
                  >
                    Full bleed
                  </button>
                </div>
              </div>
            )}

            <div className="field">
              <label>
                Artwork texture{' '}
                <span className="value">
                  {ART_TEXTURE_OPTIONS.find((o) => o.key === artTexture)?.label || 'None'}
                </span>
              </label>
              <div className="layout-options art-texture-options">
                {ART_TEXTURE_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    className={'layout-opt' + (artTexture === o.key ? ' selected' : '')}
                    onClick={() => setArtTexture(o.key)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {artTexture !== 'none' && (
              <div className="field">
                <label>
                  Artwork texture intensity <span className="value">{Math.round(artTextureIntensity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={Math.round(artTextureIntensity * 100)}
                  onChange={(e) => setArtTextureIntensity(+e.target.value / 100)}
                />
              </div>
            )}

            <div className="field">
              <label>Frame colour</label>
              <div className="swatches">
                {FRAME_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={'swatch' + (selectedFramePreset === preset.key ? ' selected' : '')}
                    style={{ background: preset.hex }}
                    title={`${preset.label} — ${preset.hex}`}
                    aria-label={preset.label}
                    onClick={() => {
                      setFrameColor(preset.hex)
                      setCustomColor(preset.hex)
                      setSelectedFramePreset(preset.key)
                    }}
                  />
                ))}
                <ColorPicker
                  value={customColor}
                  selected={selectedFramePreset === null}
                  ariaLabel="Custom frame colour"
                  title={`Custom colour — ${customColor.toUpperCase()}`}
                  palette={artworkPalette}
                  onChange={(hex) => {
                    setCustomColor(hex)
                    setFrameColor(hex)
                    setSelectedFramePreset(null)
                  }}
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: 26 }}>
              <label>
                Surface grain <span className="value">{textureLabel}</span>
              </label>
              <div className="swatches">
                {TEXTURE_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    className={'swatch' + (textureKey === o.key ? ' selected' : '')}
                    title={o.label}
                    style={{
                      width: 34,
                      height: 34,
                      background: `url(${o.src}) center/cover`,
                    }}
                    onClick={() => setTextureKey(o.key)}
                  />
                ))}
              </div>
            </div>
            <div className="field">
              <label>
                Frame texture intensity <span className="value">{Math.round(frameTextureIntensity * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={Math.round(frameTextureIntensity * 100)}
                onChange={(e) => setFrameTextureIntensity(+e.target.value / 100)}
              />
            </div>

            <div className="field">
              <label>
                Frame width <span className="value">{frameWidthPct}%</span>
              </label>
              <input
                type="range"
                min="100"
                max="200"
                value={frameWidthPct}
                onChange={(e) => setFrameWidthPct(+e.target.value)}
              />
            </div>
            <div className="field">
              <label>
                Mat width <span className="value">{matWidthPct}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={matWidthPct}
                onChange={(e) => setMatWidthPct(+e.target.value)}
              />
            </div>

            <div className="field">
              <label>Mat colour</label>
              <div className="swatches">
                {MAT_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={'swatch' + (selectedMatPreset === preset.key ? ' selected' : '')}
                    style={{ background: preset.hex }}
                    title={`${preset.label} — ${preset.hex}`}
                    aria-label={preset.label}
                    onClick={() => {
                      setMatColor(preset.hex)
                      setCustomMatColor(preset.hex)
                      setSelectedMatPreset(preset.key)
                    }}
                  />
                ))}
                <ColorPicker
                  value={customMatColor}
                  selected={selectedMatPreset === null}
                  ariaLabel="Custom mat colour"
                  title={`Custom colour — ${customMatColor.toUpperCase()}`}
                  palette={artworkPalette}
                  onChange={(hex) => {
                    setCustomMatColor(hex)
                    setMatColor(hex)
                    setSelectedMatPreset(null)
                  }}
                />
              </div>
            </div>
            <div className="field">
              <label>
                Glazing <span className="value">{glaze === 'glass' ? 'glass' : 'matte'}</span>
              </label>
              <div className="layout-options">
                <button
                  type="button"
                  className={'layout-opt' + (glaze === 'matte' ? ' selected' : '')}
                  onClick={() => setGlaze('matte')}
                >
                  Matte
                </button>
                <button
                  type="button"
                  className={'layout-opt' + (glaze === 'glass' ? ' selected' : '')}
                  onClick={() => setGlaze('glass')}
                >
                  Glass sheen
                </button>
              </div>
            </div>

            <div className="field">
              <label>
                Background{' '}
                <span className="value">
                  {backgroundMode === 'wall' ? 'Wall' : backgroundMode === 'flat' ? 'Flat colour' : 'Blurred artwork'}
                </span>
              </label>
              <div className="layout-options">
                <button
                  type="button"
                  className={'layout-opt' + (backgroundMode === 'wall' ? ' selected' : '')}
                  onClick={() => setBackgroundMode('wall')}
                >
                  Wall
                </button>
                <button
                  type="button"
                  className={'layout-opt' + (backgroundMode === 'flat' ? ' selected' : '')}
                  onClick={() => setBackgroundMode('flat')}
                >
                  Flat colour
                </button>
                <button
                  type="button"
                  className={'layout-opt' + (backgroundMode === 'blurred' ? ' selected' : '')}
                  onClick={() => setBackgroundMode('blurred')}
                >
                  Blurred artwork
                </button>
              </div>
            </div>

            {backgroundMode === 'wall' && (
              <>
                <div className="field">
                  <label>
                    Wall tone <span className="value">{wallLabel}</span>
                  </label>
                  <div className="swatches">
                    {WALL_TONES.map((w) => (
                      <button
                        key={w.hex}
                        type="button"
                        className={'swatch' + (wallColor === w.hex ? ' selected' : '')}
                        style={{ background: w.hex, width: 28, height: 28 }}
                        title={w.label}
                        onClick={() => setWallColor(w.hex)}
                      />
                    ))}
                    <ColorPicker
                      value={wallColor}
                      selected={!WALL_TONES.some((w) => w.hex === wallColor)}
                      ariaLabel="Custom wall colour"
                      title={`Custom colour — ${wallColor.toUpperCase()}`}
                      palette={artworkPalette}
                      onChange={setWallColor}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>
                    Wall texture{' '}
                    <span className="value">
                      {WALL_TEXTURE_OPTIONS.find((o) => o.key === wallTextureKey)?.label || 'None'}
                    </span>
                  </label>
                  <div className="layout-options">
                    <button
                      type="button"
                      className={'layout-opt' + (wallTextureKey === null ? ' selected' : '')}
                      onClick={() => setWallTextureKey(null)}
                    >
                      None
                    </button>
                    {WALL_TEXTURE_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        className={'layout-opt' + (wallTextureKey === o.key ? ' selected' : '')}
                        onClick={() => setWallTextureKey(o.key)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>
                    Wall texture intensity <span className="value">{Math.round(wallTextureIntensity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={Math.round(wallTextureIntensity * 100)}
                    onChange={(e) => setWallTextureIntensity(+e.target.value / 100)}
                  />
                </div>
              </>
            )}

            {backgroundMode === 'flat' && (
              <div className="field">
                <label>Flat colour</label>
                <div className="swatches">
                  {WALL_TONES.map((w) => (
                    <button
                      key={w.hex}
                      type="button"
                      className={'swatch' + (flatColor === w.hex ? ' selected' : '')}
                      style={{ background: w.hex, width: 28, height: 28 }}
                      title={w.label}
                      onClick={() => setFlatColor(w.hex)}
                    />
                  ))}
                  <ColorPicker
                    value={flatColor}
                    selected={!WALL_TONES.some((w) => w.hex === flatColor)}
                    ariaLabel="Custom flat background colour"
                    title={`Custom colour — ${flatColor.toUpperCase()}`}
                    palette={artworkPalette}
                    onChange={setFlatColor}
                  />
                </div>
              </div>
            )}

            {backgroundMode === 'blurred' && (
              <>
                {pieces.length > 1 && (
                  <div className="field">
                    <label>Background source piece</label>
                    <div className="layout-options">
                      {pieces.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          className={'layout-opt' + ((blurSourceId ?? pieces[0]?.id) === p.id ? ' selected' : '')}
                          onClick={() => setBlurSourceId(p.id)}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="field">
                  <label>
                    Blur radius <span className="value">{blurRadius}px</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={blurRadius}
                    onChange={(e) => setBlurRadius(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>
                    Dim amount <span className="value">{Math.round(dimAmount * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(dimAmount * 100)}
                    onChange={(e) => setDimAmount(Number(e.target.value) / 100)}
                  />
                </div>
              </>
            )}

            <div className="field">
              <label>
                Light style{' '}
                <span className="value">{LIGHT_STYLES.find((s) => s.key === lightStyle)?.label}</span>
              </label>
              <div className="layout-options">
                {LIGHT_STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={'layout-opt' + (lightStyle === s.key ? ' selected' : '')}
                    onClick={() => setLightStyle(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>
                Colour temperature{' '}
                <span className="value">
                  {colorTemp === 0 ? 'Neutral' : colorTemp > 0 ? `Warm ${Math.round(colorTemp * 100)}` : `Cool ${Math.round(-colorTemp * 100)}`}
                </span>
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                value={Math.round(colorTemp * 100)}
                onChange={(e) => setColorTemp(Number(e.target.value) / 100)}
              />
            </div>
            <div className="field">
              <label>
                {lightStyle === 'picture' ? 'Picture-light intensity' : 'Light intensity'}{' '}
                <span className="value">{Math.round(intensity * 100)}%</span>
              </label>
              <input
                type="range"
                min="40"
                max="170"
                value={Math.round(intensity * 100)}
                onChange={(e) => setIntensity(Number(e.target.value) / 100)}
              />
            </div>

            <div className="field">
              <label>
                Look{' '}
                <span className="value">{FILTER_PRESETS.find((p) => filtersMatch(filters, p.values))?.label ?? 'Custom'}</span>
              </label>
              <div className="layout-options filter-presets">
                {FILTER_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={'layout-opt' + (filtersMatch(filters, p.values) ? ' selected' : '')}
                    onClick={() => setFilters({ ...p.values })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {FILTER_SLIDERS.map((slider) => (
              <div className="field" key={slider.key}>
                <label>
                  {slider.label}{' '}
                  <span className="value">{filters[slider.key] === 0 ? 'Off' : filters[slider.key]}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters[slider.key]}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, [slider.key]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}

            <div className="field">
              <label>
                Output shape{' '}
                <span className="value">{ASPECT_RATIOS.find((a) => a.key === aspectRatioKey)?.label}</span>
              </label>
              <div className="ratio-options">
                {ASPECT_RATIOS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={'ratio-opt' + (aspectRatioKey === a.key ? ' selected' : '')}
                    onClick={() => {
                      setAspectRatioKey(a.key)
                      // Same reason as layout-preset and piece-count changes:
                      // manual positions are canvas-relative fractions, and
                      // changing aspect ratio resizes the canvas.
                      resetArrangement()
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {pieces.length > 1 && (
              <div className="field">
                <label>Series arrangement</label>
                <div className="ratio-options">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={'ratio-opt' + (layout === opt.key ? ' selected' : '')}
                      onClick={() => {
                        setLayout(opt.key)
                        resetArrangement()
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="btn-row">
                  <button className="btn" type="button" onClick={resetArrangement}>
                    Reset arrangement
                  </button>
                </div>
                <div className="corner-hint" style={{ marginTop: 8 }}>
                  Drag any framed piece directly in the preview to nudge it off the preset. Tap a piece to select it
                  for scale and stacking order.
                </div>
              </div>
            )}

            {selectedPieceId && pieces.some((p) => p.id === selectedPieceId) && (
              <div className="field">
                <label>
                  Selected piece scale{' '}
                  <span className="value">{Math.round((manualPositions[selectedPieceId]?.scale ?? 1) * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={Math.round((manualPositions[selectedPieceId]?.scale ?? 1) * 100)}
                  onChange={(e) => setSelectedPieceScale(+e.target.value / 100)}
                />
                <div className="btn-row">
                  <button className="btn" type="button" onClick={sendBackward}>
                    Send back
                  </button>
                  <button className="btn" type="button" onClick={bringForward}>
                    Bring forward
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={'step' + (allRectified ? '' : ' disabled')}>
            <div className="step-head">
              <span className="step-num">4</span>
              <span className="step-title">Export</span>
            </div>
            <div className="step-body">
              {exportMode === 'social' && 'Long edge sized for Instagram at the chosen output shape.'}
              {exportMode === 'hires' && 'Long edge up to 4000px, capped by the browser canvas limit.'}
              {exportMode === 'native' && "Scaled so the artwork itself keeps its full photographed resolution."}
              {exportMode === 'artwork' &&
                'Just the straightened artwork — no frame, mat or wall. For the gallery/archiving.'}
            </div>
            <div className="field">
              <div className="ratio-options">
                {EXPORT_MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={'ratio-opt' + (exportMode === m.key ? ' selected' : '')}
                    onClick={() => {
                      setExportMode(m.key)
                      setCapNotice('')
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-full" type="button" onClick={downloadPng}>
              Download PNG
            </button>
            {capNotice && <div className="cap-notice">{capNotice}</div>}
          </div>
        </div>

        <div className="footer-note">
          Everything renders locally in your browser — nothing is uploaded anywhere. Perspective correction and
          frame rendering is approximate; nudge the points and controls until it reads right to your eye.
        </div>
      </aside>

      <main className="viewer">
        <div className="viewer-top">
          <div>
            <div className="viewer-title">{header.title}</div>
            <div className="viewer-sub">{header.sub}</div>
          </div>
          {rendering && (
            <div className="loading-badge">
              <span className="dot" /> Rendering…
            </div>
          )}
        </div>
        <div className="viewer-stage">
          {!pieces.length && (
            <div className="empty-state">
              <div className="glyph">迷</div>
              <h3>Nothing loaded yet</h3>
              <p>
                Upload a photo on the left. Even an angled, imperfect phone photo works — you&apos;ll straighten it in
                the next step.
              </p>
            </div>
          )}
          {pieces.length > 0 && !showComposite && activePiece && (
            <CornerEditor
              piece={activePiece}
              onCornersChange={(corners) =>
                setPieces((prev) => prev.map((p, i) => (i === activeIndex ? { ...p, corners } : p)))
              }
            />
          )}
          {showComposite && pieces.length > 1 && (
            <canvas
              ref={compositeRef}
              className="composite-canvas draggable"
              onPointerDown={onCompositePointerDown}
              onPointerMove={onCompositePointerMove}
              onPointerUp={onCompositePointerUp}
              onPointerCancel={onCompositePointerUp}
            />
          )}
          {showComposite && pieces.length <= 1 && <canvas ref={compositeRef} className="composite-canvas" />}
        </div>
      </main>
    </div>
  )
}
