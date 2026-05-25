const MAX_EDGE = 512

/** Scale the full image to fit inside a square canvas (letterboxed), preserving the brand mark. */
export async function fitImageInSquare(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const scale = Math.min(MAX_EDGE / image.width, MAX_EDGE / image.height, 1)
    const width = Math.round(image.width * scale)
    const height = Math.round(image.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = MAX_EDGE
    canvas.height = MAX_EDGE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not prepare image canvas')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, MAX_EDGE, MAX_EDGE)
    const dx = Math.floor((MAX_EDGE - width) / 2)
    const dy = Math.floor((MAX_EDGE - height) / 2)
    ctx.drawImage(image, dx, dy, width, height)

    const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Could not encode image'))),
        mimeType,
        0.92
      )
    })

    return blob
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load image'))
    image.src = src
  })
}
