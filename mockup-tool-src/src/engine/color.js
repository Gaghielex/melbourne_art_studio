export function extractPalette(canvas, k = 4) {
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 6000)))
  const data = ctx.getImageData(0, 0, w, h).data
  const bins = {}
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const key = [Math.round(r / 24) * 24, Math.round(g / 24) * 24, Math.round(b / 24) * 24].join(',')
      bins[key] = (bins[key] || 0) + 1
    }
  }
  const sorted = Object.entries(bins).sort((a, b) => b[1] - a[1])
  const colors = sorted.slice(0, 24).map(([key]) => {
    const [r, g, b] = key.split(',').map(Number)
    return { r, g, b }
  })
  const picked = []
  for (const c of colors) {
    if (picked.length >= k) break
    const tooClose = picked.some((p) => Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) < 70)
    if (!tooClose) picked.push(c)
  }
  while (picked.length < k && colors.length) picked.push(colors[picked.length % colors.length])
  return picked
}

export function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h
  let s
  const l = (max + min) / 2
  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }
  return [h * 360, s, l]
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

export function hslToHex(h, s, l) {
  h /= 360
  let r
  let g
  let b
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0')
  return '#' + toHex(r) + toHex(g) + toHex(b)
}

export function hslToRgb(h, s, l) {
  h /= 360
  let r
  let g
  let b
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

export function hexToRgb(hex) {
  const v = hex.replace('#', '')
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }) {
  const to = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return '#' + to(r) + to(g) + to(b)
}

export function normalizeHex(input) {
  if (!input) return null
  let v = String(input).trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(v)) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2]
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null
  return '#' + v.toLowerCase()
}

export function rgbToHsv(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  const s = max === 0 ? 0 : d / max
  const v = max
  if (d !== 0) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h *= 60
  }
  return [h, s, v]
}

export function hsvToRgb(h, s, v) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

export function hsvToHex(h, s, v) {
  return rgbToHex(hsvToRgb(h, s, v))
}

export function hexToHsv(hex) {
  const rgb = hexToRgb(normalizeHex(hex) || '#000000')
  return rgbToHsv(rgb.r, rgb.g, rgb.b)
}

export function suggestFrameColors(palette) {
  let darkest = palette[0]
  let mostSaturated = palette[0]
  for (const c of palette) {
    const [, s, l] = rgbToHsl(c.r, c.g, c.b)
    const [, , dl] = rgbToHsl(darkest.r, darkest.g, darkest.b)
    if (l < dl) darkest = c
    const [, ms] = rgbToHsl(mostSaturated.r, mostSaturated.g, mostSaturated.b)
    if (s > ms) mostSaturated = c
  }
  const [dh, ds] = rgbToHsl(darkest.r, darkest.g, darkest.b)
  const [mh] = rgbToHsl(mostSaturated.r, mostSaturated.g, mostSaturated.b)

  return [
    { label: 'Ink black', hex: '#14110f' },
    { label: 'Deep walnut', hex: hslToHex(28, 0.35, 0.16) },
    { label: 'From palette', hex: hslToHex(dh, Math.min(ds * 0.5, 0.25), 0.14) },
    { label: 'Pure white', hex: '#f7f6f3' },
    { label: 'Accent tone', hex: hslToHex(mh, 0.55, 0.3) },
  ]
}

export function shade({ r, g, b }, amt) {
  const f = (v) => {
    const out = amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)
    return Math.max(0, Math.min(255, Math.round(out)))
  }
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

// v2 PRD §3.5 — mat colour presets.
export const MAT_PRESETS = [
  { key: 'white', hex: '#faf8f4', label: 'White' },
  { key: 'cream', hex: '#f0e6d2', label: 'Cream' },
  { key: 'warm-grey', hex: '#b9b2a4', label: 'Warm grey' },
  { key: 'black', hex: '#1c1b1a', label: 'Black' },
]

export const WALL_TONES = [
  { hex: '#f1efe9', label: 'Warm gallery white' },
  { hex: '#e7e2d6', label: 'Stone' },
  { hex: '#d9d4c6', label: 'Putty' },
  { hex: '#efe7dd', label: 'Cream' },
]

// v2 PRD §3.7 — scene lighting. Applied to wall/frame/mat colours before
// they reach the existing draw functions, so colour temperature and
// intensity don't need threading through every shader — only the light
// STYLE's direction (bevel highlight, drop shadow, glass sheen) needs that.
// colorTemp: -1 (cool/blue) .. 1 (warm/orange). intensity: 0 (dim) .. 2 (bright), 1 = neutral.
export function applyLighting(hex, colorTemp = 0, intensity = 1) {
  const rgb = hexToRgb(hex)
  const warmR = colorTemp > 0 ? colorTemp * 18 : 0
  const warmB = colorTemp > 0 ? colorTemp * 10 : 0
  const coolB = colorTemp < 0 ? -colorTemp * 18 : 0
  const coolR = colorTemp < 0 ? -colorTemp * 8 : 0
  const r = rgb.r + warmR - coolR
  const g = rgb.g
  const b = rgb.b + coolB - warmB
  const scale = Math.max(0.4, Math.min(1.7, intensity))
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * scale)))
  const toHex = (v) => f(v).toString(16).padStart(2, '0')
  return '#' + toHex(r) + toHex(g) + toHex(b)
}

// v2 PRD §3.7 — light style presets. Museum is the existing baseline (soft,
// mostly-overhead room light); Picture light comes from directly above each
// piece (steep, mostly-downward shadow); Window is raking light from one
// side (long lateral shadow, minimal downward component). The same vector
// drives frame bevel shading, drop-shadow direction, and glass sheen angle,
// per the PRD's requirement that all three stay consistent.
export const LIGHT_STYLES = [
  { key: 'museum', label: 'Museum' },
  { key: 'picture', label: 'Picture light' },
  { key: 'window', label: 'Window' },
]

const LIGHT_PRESETS = {
  museum: { lx: -0.52, ly: -0.63, shadowOxFactor: 0.04, shadowOyFactor: 0.028, sheenAngle: -32, wallDarken: 0 },
  picture: { lx: -0.12, ly: -0.92, shadowOxFactor: 0.018, shadowOyFactor: 0.09, sheenAngle: -12, wallDarken: 0 },
  window: { lx: -0.88, ly: -0.32, shadowOxFactor: 0.075, shadowOyFactor: 0.014, sheenAngle: -58, wallDarken: 0 },
}

export function getLightPreset(style) {
  return LIGHT_PRESETS[style] || LIGHT_PRESETS.museum
}
