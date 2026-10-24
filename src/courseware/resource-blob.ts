/** JSZip 的 Blob 没有 MIME，SVG 作为 img 源时必须显式声明类型。 */
export function resourceBlob(blob: Blob, path: string): Blob {
  if (/\.svg$/i.test(path) && blob.type !== 'image/svg+xml') {
    return new Blob([blob], { type: 'image/svg+xml' })
  }
  return blob
}
