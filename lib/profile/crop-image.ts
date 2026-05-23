const MAX_AVATAR_EDGE = 512

export async function cropImageToSquare(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const edge = Math.min(image.width, image.height, MAX_AVATAR_EDGE)
    const sx = Math.floor((image.width - edge) / 2)
    const sy = Math.floor((image.height - edge) / 2)

    const canvas = document.createElement('canvas')
    canvas.width = edge
    canvas.height = edge
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not prepare image canvas')

    ctx.drawImage(image, sx, sy, edge, edge, 0, 0, edge, edge)

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
