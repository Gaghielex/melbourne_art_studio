import { useEffect, useState } from 'react'
import { fetchSiteArtwork, GALLERIES, loadSiteGallery } from './siteGallery.js'

// Modal for choosing artworks from the main site's digital and traditional
// galleries. `limit` is how many more pieces the mockup can take.
export function GalleryPicker({ limit, onAdd, onClose }) {
  const [galleryKey, setGalleryKey] = useState(GALLERIES[0].key)
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError('')
    loadSiteGallery(GALLERIES.find((g) => g.key === galleryKey))
      .then((list) => !cancelled && setItems(list))
      .catch(() => !cancelled && setError('Could not load the gallery. Check your connection and try again.'))
    return () => {
      cancelled = true
    }
  }, [galleryKey])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const toggle = (item) =>
    setSelected((prev) => {
      if (prev.some((s) => s.id === item.id)) return prev.filter((s) => s.id !== item.id)
      return prev.length >= limit ? prev : [...prev, item]
    })

  const add = async () => {
    setBusy(true)
    setError('')
    try {
      const files = await Promise.all(selected.map(fetchSiteArtwork))
      await onAdd(files)
      onClose()
    } catch {
      setError('Could not download one of the artworks. Try again.')
      setBusy(false)
    }
  }

  return (
    <div className="picker-backdrop" onClick={() => !busy && onClose()}>
      <div className="picker" role="dialog" aria-modal="true" aria-label="Choose artwork from the gallery" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <h2 className="picker-title">Choose from the gallery</h2>
          <button type="button" className="picker-close" aria-label="Close" onClick={onClose} disabled={busy}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="chip-row picker-tabs" role="tablist">
          {GALLERIES.map((g) => (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={galleryKey === g.key}
              className={'chip' + (galleryKey === g.key ? ' selected' : '')}
              onClick={() => setGalleryKey(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="picker-body">
          {error && !items && <div className="picker-note">{error}</div>}
          {!items && !error && <div className="picker-note">Loading artworks…</div>}
          {items && (
            <div className="picker-grid">
              {items.map((item) => {
                const order = selected.findIndex((s) => s.id === item.id)
                const isSelected = order !== -1
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={'picker-item' + (isSelected ? ' selected' : '')}
                    aria-pressed={isSelected}
                    aria-label={item.title}
                    disabled={!isSelected && selected.length >= limit}
                    onClick={() => toggle(item)}
                  >
                    <img src={item.thumb} alt="" loading="lazy" draggable="false" />
                    {isSelected && <span className="picker-badge">{order + 1}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="picker-foot">
          <span className="picker-count">
            {selected.length} of {limit} selected
          </span>
          {error && items && <span className="picker-error">{error}</span>}
          <button type="button" className="btn btn-primary" disabled={!selected.length || busy} onClick={add}>
            {busy ? 'Adding…' : `Add ${selected.length || ''} artwork${selected.length === 1 ? '' : 's'}`.replace('  ', ' ')}
          </button>
        </div>
      </div>
    </div>
  )
}
