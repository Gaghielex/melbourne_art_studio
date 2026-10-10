import { useEffect, useRef, useState } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 5

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Pinch-zoom / pan confined to the canvas area. The stage clips its content and
// owns all touch gestures (touch-action: none), so the page itself never zooms —
// the menus and controls around it keep their size and position. Single-finger
// input passes straight through to the canvas; a second finger starts a pinch
// and swallows both pointers until they lift, so a drag is never mistaken for one.
export function ZoomStage({ children, resetKey, onPinchStart }) {
  const stageRef = useRef(null)
  const pointers = useRef(new Map())
  const suppressed = useRef(new Set())
  const gesture = useRef(null)
  const pinchStartRef = useRef(onPinchStart)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  pinchStartRef.current = onPinchStart

  useEffect(() => {
    setView({ s: 1, x: 0, y: 0 })
  }, [resetKey])

  const bounded = (s, x, y) => {
    const rect = stageRef.current.getBoundingClientRect()
    const mx = ((s - 1) * rect.width) / 2
    const my = ((s - 1) * rect.height) / 2
    return { s, x: clamp(x, -mx, mx), y: clamp(y, -my, my) }
  }

  // Zoom about a client-space point so that point stays under the fingers/cursor.
  const zoomAbout = (base, s, mx, my, startMx = mx, startMy = my) => {
    const rect = stageRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const px = (startMx - cx - base.x) / base.s
    const py = (startMy - cy - base.y) / base.s
    return bounded(s, mx - cx - px * s, my - cy - py * s)
  }

  const pair = () => {
    const [a, b] = [...pointers.current.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
  }

  const onDown = (e) => {
    if (e.target.closest?.('.zoom-reset')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2) {
      suppressed.current.add(e.pointerId)
      for (const id of pointers.current.keys()) suppressed.current.add(id)
      if (!gesture.current) {
        gesture.current = { ...pair(), base: viewRef.current }
        pinchStartRef.current?.()
      }
      e.stopPropagation()
    }
  }

  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (!suppressed.current.has(e.pointerId)) return
    e.stopPropagation()
    if (gesture.current && pointers.current.size >= 2) {
      const g = gesture.current
      const now = pair()
      const s = clamp(g.base.s * (now.dist / g.dist), MIN_SCALE, MAX_SCALE)
      setView(zoomAbout(g.base, s, now.mx, now.my, g.mx, g.my))
    }
  }

  const onUp = (e) => {
    pointers.current.delete(e.pointerId)
    if (suppressed.current.delete(e.pointerId)) e.stopPropagation()
    if (pointers.current.size < 2) gesture.current = null
    if (view.s < 1.02) setView({ s: 1, x: 0, y: 0 })
  }

  // Trackpad pinch (ctrl+wheel) on desktop zooms the canvas, not the page.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const base = viewRef.current
      const s = clamp(base.s * Math.exp(-e.deltaY * 0.01), MIN_SCALE, MAX_SCALE)
      setView(s <= 1.001 ? { s: 1, x: 0, y: 0 } : zoomAbout(base, s, e.clientX, e.clientY))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoomed = view.s > 1.01

  return (
    <div
      ref={stageRef}
      className="viewer-stage"
      onPointerDownCapture={onDown}
      onPointerMoveCapture={onMove}
      onPointerUpCapture={onUp}
      onPointerCancelCapture={onUp}
    >
      <div
        className="zoom-content"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
      >
        {children}
      </div>
      {zoomed && (
        <button type="button" className="zoom-reset" onClick={() => setView({ s: 1, x: 0, y: 0 })}>
          <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true" /> {view.s.toFixed(1)}×
        </button>
      )}
    </div>
  )
}
