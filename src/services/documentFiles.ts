// Like attendance photos, documents are stored as data URLs on a Firestore
// document (free Spark plan, no Storage bucket). Firestore caps a document at
// 1 MB, so photos of letters/certificates are resized to stay readable but small.

export const ACCEPTED_DOCUMENT_TYPES = 'image/jpeg,image/png,image/webp,application/pdf'

const MAX_DATA_URL_LENGTH = 900_000
const MAX_PDF_BYTES = 650_000

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not open this image. Please upload a JPG or PNG.'))
    img.src = src
  })
}

function renderJpeg(img: HTMLImageElement, maxDimension: number, quality: number) {
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image.')
  // White background so transparent PNGs don't turn black as JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

export interface PreparedDocument {
  dataUrl: string
  mimeType: string
  size: number
}

export async function prepareDocument(file: File): Promise<PreparedDocument> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error('PDFs must be under 650 KB. Upload a photo of the page instead, or compress the PDF.')
    }
    const dataUrl = await readAsDataUrl(file)
    return { dataUrl, mimeType: 'application/pdf', size: file.size }
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Upload a photo (JPG, PNG) or a PDF.')
  }

  const img = await loadImage(await readAsDataUrl(file))
  // Try progressively smaller renders until it fits, keeping text legible first.
  for (const [dimension, quality] of [[1600, 0.72], [1300, 0.65], [1000, 0.6], [800, 0.55]] as const) {
    const dataUrl = renderJpeg(img, dimension, quality)
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
      return { dataUrl, mimeType: 'image/jpeg', size: Math.round((dataUrl.length * 3) / 4) }
    }
  }
  throw new Error('This image is too large even after compression. Try a closer, well-lit photo.')
}

/*
 * Types the browser may render from a blob URL. Anything else (HTML, SVG…)
 * would run as a page on this app's origin, so it is served as a download.
 */
const RENDERABLE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function declaredType(dataUrl: string) {
  return dataUrl.match(/^data:([^;,]+)/)?.[1]?.toLowerCase() ?? ''
}

export function isRenderableDocument(dataUrl: string) {
  return RENDERABLE_TYPES.includes(declaredType(dataUrl))
}

/* The type a blob gets: only allow-listed types may render; the rest download. */
export function blobTypeFor(dataUrl: string) {
  return isRenderableDocument(dataUrl) ? declaredType(dataUrl) : 'application/octet-stream'
}

/* Blob URLs open reliably in a new tab or iframe; data: URLs often don't. */
export function dataUrlToObjectUrl(dataUrl: string) {
  const comma = dataUrl.indexOf(',')
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : ''
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : ''
  let raw = ''
  try {
    raw = meta.includes(';base64') ? atob(payload) : decodeURIComponent(payload)
  } catch {
    raw = ''
  }
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: blobTypeFor(dataUrl) }))
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
