import { useEffect, useRef, useState } from 'react'
import { paintGlobe } from './globe-projection'

export function GlobeCanvas({ source, camera, up, look, diameter }: {
  source?: string; camera: number[]; up: number[]; look: number[]; diameter: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [texture, setTexture] = useState<ImageData | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setTexture(null)
    setFailed(false)
    if (!source) { setFailed(true); return }
    let disposed = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (disposed) return
      try {
        const surface = document.createElement('canvas')
        surface.width = image.naturalWidth
        surface.height = image.naturalHeight
        const context = surface.getContext('2d', { willReadFrequently: true })
        if (!context) { setFailed(true); return }
        context.drawImage(image, 0, 0)
        setTexture(context.getImageData(0, 0, surface.width, surface.height))
      } catch { setFailed(true) }
    }
    image.onerror = () => { if (!disposed) setFailed(true) }
    image.src = source
    return () => { disposed = true }
  }, [source])
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !texture) return
    const frame = requestAnimationFrame(() => paintGlobe(canvas, texture, camera, up, look))
    return () => cancelAnimationFrame(frame)
  }, [texture, camera, up, look, diameter])
  const resolution = Math.max(64, Math.min(900, Math.ceil(diameter * 1.5)))
  return <div style={{ width: diameter, height: diameter, position: 'relative' }}>
    <canvas ref={ref} width={resolution} height={resolution} aria-label="地球球面" style={{ width: '100%', height: '100%' }} />
    {failed && <span role="status" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#ffffff' }}>地球纹理未能加载</span>}
  </div>
}
