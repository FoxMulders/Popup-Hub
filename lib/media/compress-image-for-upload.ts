const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const DEFAULT_MAX_EDGE = 2048
const MIN_MAX_EDGE = 720
const EDGE_SHRINK_FACTOR = 0.82
const QUALITY_STEPS = [0.88, 0.82, 0.76, 0.7, 0.64, 0.58, 0.52, 0.46]

export function isCompressibleImageType(mime: string): boolean {
  return IMAGE_TYPES.has(mime)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load image'))
    image.src = src
  })
}

function outputMime(file: File): string {
  if (file.type === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

function fileFromBlob(blob: Blob, original: File, mime: string): File {
  const base = original.name.replace(/\.[^.]+$/, '') || 'image'
  const ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg'
  return new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() })
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), mime, quality)
  })
}

/**
 * Shrinks and re-encodes large photos in the browser so uploads stay under storage limits.
 * Returns the original file when it is already small enough or cannot be processed here.
 */
export async function compressImageForUpload(
  file: File,
  maxBytes: number,
  options?: { maxEdge?: number }
): Promise<File> {
  if (!isCompressibleImageType(file.type) || file.size <= maxBytes) {
    return file
  }

  if (typeof document === 'undefined') {
    return file
  }

  const mime = outputMime(file)
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    let maxEdge = Math.min(
      options?.maxEdge ?? DEFAULT_MAX_EDGE,
      image.width,
      image.height
    )

    while (maxEdge >= MIN_MAX_EDGE) {
      const scale = Math.min(maxEdge / image.width, maxEdge / image.height, 1)
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) break

      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
      }
      ctx.drawImage(image, 0, 0, width, height)

      for (const quality of QUALITY_STEPS) {
        const blob = await encodeCanvas(canvas, mime, quality)
        if (blob && blob.size <= maxBytes) {
          return fileFromBlob(blob, file, mime)
        }
      }

      maxEdge = Math.floor(maxEdge * EDGE_SHRINK_FACTOR)
    }

    return file
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
