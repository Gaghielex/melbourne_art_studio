// Artworks from the main Melbourne ArtStudio site, so they can be dropped into a
// mockup without downloading them first. The gallery pages are read at runtime
// (the same markup the site's own lightbox uses), so newly added artworks show up
// here without touching this tool.
//
// In production this tool is served from the same origin as the site
// (/mockup-tool/), so these are same-origin requests. In local development the
// site is fetched cross-origin; GitHub Pages allows that.
const SITE = import.meta.env.DEV ? 'https://melbourneartstudio.com' : window.location.origin

export const GALLERIES = [
  { key: 'digital', label: 'Digital', path: '/digital-art/' },
  { key: 'traditional', label: 'Traditional', path: '/traditional-art/' },
]

const cache = new Map()

async function loadGallery({ path }) {
  const pageUrl = new URL(path, SITE).href
  const res = await fetch(pageUrl)
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`)
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
  return Array.from(doc.querySelectorAll('.gallery-item img')).map((img) => {
    const thumb = new URL(img.getAttribute('src'), pageUrl).href
    const full = new URL(img.dataset.full || img.getAttribute('src'), pageUrl).href
    return {
      id: full,
      title: img.dataset.title || img.getAttribute('alt') || 'Untitled',
      medium: img.dataset.medium || '',
      thumb,
      full,
    }
  })
}

export function loadSiteGallery(gallery) {
  if (!cache.has(gallery.key)) {
    const request = loadGallery(gallery)
    // Don't cache failures, so reopening the picker retries.
    request.catch(() => cache.delete(gallery.key))
    cache.set(gallery.key, request)
  }
  return cache.get(gallery.key)
}

// Downloads the full-size artwork as a File, ready for the normal upload path.
export async function fetchSiteArtwork(item) {
  const res = await fetch(item.full)
  if (!res.ok) throw new Error(`Could not load "${item.title}" (${res.status})`)
  const blob = await res.blob()
  const ext = (blob.type.split('/')[1] || 'webp').replace('jpeg', 'jpg')
  return new File([blob], `${item.title}.${ext}`, { type: blob.type || 'image/webp' })
}
