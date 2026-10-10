const BASE = import.meta.env.BASE_URL

// Each column stacks one or two artworks; `grow` varies the stacked heights so
// the strip reads as a masonry rather than a uniform grid.
const COLUMNS = [
  { w: 190, items: [{ src: 'koi', grow: 1 }] },
  { w: 250, items: [{ src: 'japan', grow: 1 }, { src: 'mononoke', grow: 1.35 }] },
  { w: 220, items: [{ src: 'fox', grow: 1.4 }, { src: 'trawool', grow: 1 }] },
  { w: 200, items: [{ src: 'island', grow: 1 }] },
  { w: 240, items: [{ src: 'beach', grow: 1 }, { src: 'ramen', grow: 1.3 }] },
  { w: 190, items: [{ src: 'cat', grow: 1 }] },
  { w: 230, items: [{ src: 'kimetsu', grow: 1.25 }, { src: 'oolong', grow: 1 }] },
  { w: 190, items: [{ src: 'monstera', grow: 1 }] },
]

function Strip({ ariaHidden }) {
  return (
    <div className="carousel-set" aria-hidden={ariaHidden || undefined}>
      {COLUMNS.map((col, i) => (
        <div className="carousel-col" style={{ width: col.w }} key={i}>
          {col.items.map((it) => (
            <img
              key={it.src}
              src={`${BASE}carousel/${it.src}.webp`}
              alt=""
              loading="lazy"
              draggable="false"
              style={{ flexGrow: it.grow }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function Carousel() {
  return (
    <div className="carousel" role="presentation">
      <div className="carousel-track">
        <Strip />
        <Strip ariaHidden />
      </div>
      <div className="carousel-overlay" />
      <div className="carousel-brand">
        <img className="carousel-logo" src={`${BASE}branding/magpie-dark.svg`} alt="" />
        <div className="carousel-name">
          <strong>Melbourne</strong> ArtStudio
        </div>
      </div>
    </div>
  )
}
