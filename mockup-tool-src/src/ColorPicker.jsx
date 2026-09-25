import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { hexToHsv, hsvToHex, normalizeHex } from './engine/color.js'

const MAX_RECENTS = 8
let recents = []
const recentListeners = new Set()

function useRecentColors() {
  const [list, setList] = useState(recents)
  useEffect(() => {
    const sync = () => setList(recents.slice())
    recentListeners.add(sync)
    return () => recentListeners.delete(sync)
  }, [])
  const remember = (hex) => {
    const n = normalizeHex(hex)
    if (!n) return
    recents = [n, ...recents.filter((c) => c !== n)].slice(0, MAX_RECENTS)
    recentListeners.forEach((fn) => fn())
  }
  return [list, remember]
}

function hueGradient() {
  return 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'
}

function svBackground(hue) {
  return `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`
}

function pointerFraction(e, el) {
  const rect = el.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
  }
}

function ColorSwatchRow({ colors, current, onPick, label }) {
  if (!colors.length) return null
  return (
    <div className="color-picker-section">
      <div className="color-picker-section-label">{label}</div>
      <div className="color-picker-mini-swatches">
        {colors.map((hex) => (
          <button
            key={hex}
            type="button"
            className={'color-picker-mini' + (normalizeHex(current) === hex ? ' selected' : '')}
            style={{ background: hex }}
            title={hex.toUpperCase()}
            aria-label={hex}
            onClick={() => onPick(hex)}
          />
        ))}
      </div>
    </div>
  )
}

function ColorPickerPopover({ value, onChange, onClose, palette, getAnchorRect, ignoreRef }) {
  const popRef = useRef(null)
  const hsvRef = useRef(hexToHsv(value))
  const [hsv, setHsv] = useState(() => hexToHsv(value))
  const [hexDraft, setHexDraft] = useState(value)
  const [recents, remember] = useRecentColors()
  const [pos, setPos] = useState(() => placePopover(getAnchorRect()))

  useEffect(() => {
    const next = hexToHsv(value)
    setHsv((prev) => (next[1] < 0.001 ? [prev[0], next[1], next[2]] : next))
    setHexDraft(normalizeHex(value) || value)
  }, [value])

  useEffect(() => {
    hsvRef.current = hsv
  }, [hsv])

  const onCloseRef = useRef(onClose)
  const getAnchorRectRef = useRef(getAnchorRect)
  onCloseRef.current = onClose
  getAnchorRectRef.current = getAnchorRect

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || ignoreRef?.current?.contains(e.target)) return
      onCloseRef.current()
    }
    const onReposition = () => setPos(placePopover(getAnchorRectRef.current()))
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [ignoreRef])

  const commit = (nextHsv, rememberIt) => {
    const hex = hsvToHex(nextHsv[0], nextHsv[1], nextHsv[2])
    setHsv(nextHsv)
    setHexDraft(hex)
    onChange(hex)
    if (rememberIt) remember(hex)
  }

  const applyHex = (raw, rememberIt) => {
    const hex = normalizeHex(raw)
    if (!hex) {
      setHexDraft(hsvToHex(hsv[0], hsv[1], hsv[2]))
      return
    }
    const next = hexToHsv(hex)
    setHsv((prev) => (next[1] < 0.001 ? [prev[0], next[1], next[2]] : next))
    setHexDraft(hex)
    onChange(hex)
    if (rememberIt) remember(hex)
  }

  const bindDrag = (apply) => ({
    onPointerDown: (e) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      apply(e)
    },
    onPointerMove: (e) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      apply(e)
    },
    onPointerUp: (e) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      remember(hsvToHex(hsvRef.current[0], hsvRef.current[1], hsvRef.current[2]))
    },
  })

  const [h, s, v] = hsv
  const hex = hsvToHex(h, s, v)

  return (
    <div
      ref={popRef}
      className="color-picker-pop"
      role="dialog"
      aria-label="Colour picker"
      style={{ top: pos.top, left: pos.left }}
    >
      <div
        className="color-picker-sv"
        style={{ background: svBackground(h) }}
        {...bindDrag((e) => {
          const { x, y } = pointerFraction(e, e.currentTarget)
          commit([hsvRef.current[0], x, 1 - y], false)
        })}
      >
        <span className="color-picker-thumb" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
      </div>
      <div
        className="color-picker-hue"
        style={{ background: hueGradient() }}
        {...bindDrag((e) => {
          const { x } = pointerFraction(e, e.currentTarget)
          commit([x * 360, hsvRef.current[1], hsvRef.current[2]], false)
        })}
      >
        <span className="color-picker-hue-thumb" style={{ left: `${(h / 360) * 100}%` }} />
      </div>
      <div className="color-picker-hex-row">
        <span className="color-picker-preview" style={{ background: hex }} />
        <label className="color-picker-hex-label">
          Hex
          <input
            className="color-picker-hex"
            value={hexDraft}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Hex colour"
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={() => applyHex(hexDraft, true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyHex(hexDraft, true)
              }
            }}
          />
        </label>
      </div>
      <ColorSwatchRow colors={recents} current={hex} label="Recent" onPick={(c) => applyHex(c, true)} />
      <ColorSwatchRow colors={palette} current={hex} label="From artwork" onPick={(c) => applyHex(c, true)} />
    </div>
  )
}

function placePopover(anchorRect) {
  const width = 236
  const height = 360
  const gap = 8
  let left = anchorRect.left
  let top = anchorRect.bottom + gap
  if (left + width > window.innerWidth - gap) left = window.innerWidth - width - gap
  if (left < gap) left = gap
  if (top + height > window.innerHeight - gap) top = anchorRect.top - height - gap
  if (top < gap) top = gap
  return { top, left }
}

export function ColorPicker({ value, onChange, selected, ariaLabel, title, palette = [] }) {
  const btnRef = useRef(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={'swatch-custom' + (selected ? ' selected' : '')}
        style={{ background: value }}
        title={title || `Custom colour — ${String(value).toUpperCase()}`}
        aria-label={ariaLabel || 'Custom colour'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        +
      </button>
      {open &&
        createPortal(
          <ColorPickerPopover
            value={value}
            onChange={onChange}
            onClose={() => setOpen(false)}
            palette={palette}
            getAnchorRect={() => btnRef.current.getBoundingClientRect()}
            ignoreRef={btnRef}
          />,
          document.body,
        )}
    </>
  )
}
