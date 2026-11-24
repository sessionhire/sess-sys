/**
 * A JPEG's size in pixels, read from its own header: the frame marker (SOF) that every JPEG has before its picture.
 * For photos sent from someone's link, whose page can't say the size beside each one. Nothing when the bytes aren't a
 * JPEG a browser would draw.
 */
export function jpegSize(b: Buffer): { width: number; height: number } | undefined {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return undefined
  let at = 2
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) return undefined
    const marker = b[at + 1]!
    // Padding before a marker.
    if (marker === 0xff) {
      at += 1
      continue
    }
    // Markers with nothing after them.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2
      continue
    }
    // The picture itself, or the end: no frame came first.
    if (marker === 0xda || marker === 0xd9) return undefined
    const length = b.readUInt16BE(at + 2)
    if (length < 2) return undefined
    // A frame: every SOF but the tables that share its range (DHT, JPG, DAC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = b.readUInt16BE(at + 5)
      const width = b.readUInt16BE(at + 7)
      return width > 0 && height > 0 ? { width, height } : undefined
    }
    at += 2 + length
  }
  return undefined
}
