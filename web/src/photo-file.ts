import { NOT_A_PHOTO } from '@sh/shared'

/**
 * A photo made small on the device before it's sent (ADR 0065, ADR 0083):
 * a phone's photo of several megabytes goes as a few dozen kilobytes, comes
 * out the right way up, and where it was taken (its EXIF) stays behind.
 * A person's is the middle square; a product's keeps its shape, as a rack
 * panel is wide. The browser turns it the right way up as it draws it.
 */
export async function shrinkPhoto(file: File, { side, square, png = false }: { side: number; square: boolean; png?: boolean }): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    // An iPhone's HEIC opens in Safari; a browser that can't open it is told to send another kind.
    await img.decode().catch(() => {
      throw new Error(NOT_A_PHOTO)
    })
    const svg = isSvg(file)
    // A drawing (SVG) can say its shape only in its viewBox, which some browsers don't give as a size.
    const [w, h] = img.naturalWidth && img.naturalHeight ? [img.naturalWidth, img.naturalHeight] : svg ? viewBoxOf(await file.text()) : [0, 0]
    if (!w || !h) throw new Error(NOT_A_PHOTO)
    // What's taken from the photo, and how big it's drawn.
    const crop = square ? { x: (w - Math.min(w, h)) / 2, y: (h - Math.min(w, h)) / 2, w: Math.min(w, h), h: Math.min(w, h) } : { x: 0, y: 0, w, h }
    // A drawing is sharp at any size, so it's drawn out to the full side; a photo is only ever made smaller.
    const scale = svg ? side / Math.max(crop.w, crop.h) : Math.min(1, side / Math.max(crop.w, crop.h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(crop.w * scale))
    canvas.height = Math.max(1, Math.round(crop.h * scale))
    const g = canvas.getContext('2d')
    if (!g) throw new Error(NOT_A_PHOTO)
    // A logo goes on white, as the label is, so a see-through one doesn't turn black; and as a PNG, so its edges stay sharp.
    if (png) {
      g.fillStyle = '#fff'
      g.fillRect(0, 0, canvas.width, canvas.height)
    }
    if (svg && !square) g.drawImage(img, 0, 0, canvas.width, canvas.height)
    else g.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((done) => (png ? canvas.toBlob(done, 'image/png') : canvas.toBlob(done, 'image/jpeg', 0.85))).catch(
      () => {
        // An older Safari won't let a drawing out of the canvas again.
        throw new Error(svg ? "This browser can't turn that SVG into a picture. Send it as a PNG instead." : NOT_A_PHOTO)
      },
    )
    if (!blob) throw new Error(NOT_A_PHOTO)
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Whether a file is a drawing (SVG) rather than a photo. */
export const isSvg = (file: File) => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)

/** A drawing's shape from its width and height, or its viewBox, as [width, height]; [0, 0] when it says neither. */
export function viewBoxOf(text: string): [number, number] {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0] ?? ''
  const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1]
  const w = parseFloat(attr('width') ?? '')
  const h = parseFloat(attr('height') ?? '')
  if (w > 0 && h > 0 && !/%/.test(attr('width')! + attr('height')!)) return [w, h]
  const box = (attr('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  return box.length === 4 && box[2]! > 0 && box[3]! > 0 ? [box[2]!, box[3]!] : [0, 0]
}

/** How big a picture is, in pixels, before it's made smaller: a drawing has no pixels to run out of, so it's \`drawing\`. */
export async function measurePicture(file: File): Promise<{ w: number; h: number; drawing: boolean }> {
  if (isSvg(file)) {
    const [w, h] = viewBoxOf(await file.text())
    return { w, h, drawing: true }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { w: img.naturalWidth, h: img.naturalHeight, drawing: false }
  } catch {
    return { w: 0, h: 0, drawing: false }
  } finally {
    URL.revokeObjectURL(url)
  }
}
