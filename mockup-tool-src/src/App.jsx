import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WALL_TONES } from './engine/color.js'
import { defaultCorners, rectifyPiece } from './engine/geometry.js'
import { downloadCanvasPng, renderScene } from './engine/scene.js'
import { loadTextures, TEXTURE_OPTIONS } from './engine/textures.js'

const MAX_PIECES = 3
const MAX_DISPLAY = 560
const FRAME_PRESETS = [
  { key: 'dark', label: 'Dark', hex: '#1C1B1A' },
  { key: 'natural', label: 'Natural wood', hex: '#8A6242' },
  { key: 'white', label: 'White', hex: '#F2EFE8' },
]

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
  const c = piece.corners
  ctx.strokeStyle = 'rgba(79,70,229,0.95)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(c[0].x, c[0].y)
  for (let i = 1; i < 4; i++) ctx.lineTo(c[i].x, c[i].y)
  ctx.closePath()
  ctx.stroke()
  c.forEach((pt) => {
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

  const [pieces, setPieces] = useState([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [frameColor, setFrameColor] = useState(FRAME_PRESETS[0].hex)
  const [customColor, setCustomColor] = useState(FRAME_PRESETS[0].hex)
  const [selectedFramePreset, setSelectedFramePreset] = useState(FRAME_PRESETS[0].key)
  const [frameWidthPct, setFrameWidthPct] = useState(100)
  const [matWidthPct, setMatWidthPct] = useState(100)
  const [wallColor, setWallColor] = useState(WALL_TONES[0].hex)
  const [layout, setLayout] = useState('row')
  const [textureKey, setTextureKey] = useState('none')
  const [glaze, setGlaze] = useState('matte')
  const [texturesReady, setTexturesReady] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [editingCorners, setEditingCorners] = useState(true)
  const [theme, setTheme] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  const activePiece = pieces[activeIndex] || null
  const allRectified = pieces.length > 0 && pieces.every((p) => p.rectified)
  const textureLabel = TEXTURE_OPTIONS.find((o) => o.key === textureKey)?.short || 'flat'
  const wallLabel = WALL_TONES.find((w) => w.hex === wallColor)?.label || ''

  useEffect(() => {
    loadTextures().then(() => setTexturesReady(true))
  }, [])

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
    if (!next.length) {
    }
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
      const next = pieces.map((p, i) => (i === activeIndex ? { ...p, rectified } : p))
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

  const paintComposite = useCallback(() => {
    const canvas = compositeRef.current
    if (!canvas || !allRectified) return
    const scene = renderScene({
      pieces,
      frameWidthPct,
      matWidthPct,
      layout,
      wallColor,
      frameColor,
      textureKey,
      glaze,
    })
    if (!scene) return
    canvas.width = scene.width
    canvas.height = scene.height
    canvas.getContext('2d').drawImage(scene, 0, 0)
  }, [allRectified, pieces, frameWidthPct, matWidthPct, layout, wallColor, frameColor, textureKey, glaze])

  useEffect(() => {
    if (!allRectified) return
    cancelAnimationFrame(renderRaf.current)
    renderRaf.current = requestAnimationFrame(paintComposite)
    return () => cancelAnimationFrame(renderRaf.current)
  }, [allRectified, paintComposite, texturesReady])

  const downloadPng = (e) => {
    e.preventDefault()
    const scene = renderScene({
      pieces,
      frameWidthPct,
      matWidthPct,
      layout,
      wallColor,
      frameColor,
      textureKey,
      glaze,
    })
    if (!scene) return
    downloadCanvasPng(scene, 'melbourne-artstudio-mockup.png')
  }

  const header = useMemo(() => {
    if (!pieces.length) {
      return {
        title: 'Start with a photo',
        sub: 'Upload one to three photos of your traditional pieces to begin.',
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
            <div className="step-body">Photos, not scans, are fine. Up to 3 pieces for a series mockup.</div>
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
                <div className="dropzone-hint">JPG or PNG, up to 3. Nothing is uploaded to a server.</div>
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
                <label
                  className={'swatch-custom' + (selectedFramePreset === null ? ' selected' : '')}
                  title={`Custom colour — ${customColor}`}
                  style={{ background: customColor }}
                >
                  +
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value)
                      setFrameColor(e.target.value)
                      setSelectedFramePreset(null)
                    }}
                    aria-label="Custom frame colour"
                  />
                </label>
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
                      background: o.src ? `url(${o.src}) center/cover` : 'linear-gradient(135deg, #2a2723, #2a2723)',
                    }}
                    onClick={() => setTextureKey(o.key)}
                  />
                ))}
              </div>
            </div>

            <div className="field">
              <label>
                Frame width <span className="value">{frameWidthPct}%</span>
              </label>
              <input
                type="range"
                min="40"
                max="180"
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
              </div>
            </div>

            {pieces.length > 1 && (
              <div className="field">
                <label>Series arrangement</label>
                <div className="layout-options">
                  <button
                    type="button"
                    className={'layout-opt' + (layout === 'row' ? ' selected' : '')}
                    onClick={() => setLayout('row')}
                  >
                    <svg width="34" height="24">
                      <rect x="1" y="4" width="9" height="16" fill="none" />
                      <rect x="13" y="4" width="9" height="16" fill="none" />
                      <rect x="25" y="4" width="8" height="16" fill="none" />
                    </svg>
                    Lined up
                  </button>
                  <button
                    type="button"
                    className={'layout-opt' + (layout === 'stagger' ? ' selected' : '')}
                    onClick={() => setLayout('stagger')}
                  >
                    <svg width="34" height="24">
                      <rect x="1" y="7" width="9" height="16" fill="none" />
                      <rect x="13" y="1" width="9" height="16" fill="none" />
                      <rect x="25" y="7" width="8" height="16" fill="none" />
                    </svg>
                    Salon-stagger
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
            <div className="step-body">Rendered at web/social resolution.</div>
            <button className="btn btn-primary btn-full" type="button" onClick={downloadPng}>
              Download PNG
            </button>
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
          {showComposite && <canvas ref={compositeRef} className="composite-canvas" />}
        </div>
      </main>
    </div>
  )
}
