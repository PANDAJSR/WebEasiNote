import { useEffect, useRef, useState } from 'react'
import { paintGlobe } from './globe-projection'
import { createGlobeWebGL } from './globe-webgl'

export function GlobeCanvas({ source, camera, up, look, width, height }: {
  source?: string; camera: number[]; up: number[]; look: number[]; width: number; height: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [texture, setTexture] = useState<ImageData | null>(null)
  const [failed, setFailed] = useState(false)
  const renderer = useRef<ReturnType<typeof createGlobeWebGL>>(null)
  useEffect(() => {
    if (ref.current) renderer.current = createGlobeWebGL(ref.current)
    return () => { renderer.current?.dispose(); renderer.current = null }
  }, [])
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
    if (!canvas) return
    const frame = requestAnimationFrame(() => {
      if (renderer.current) renderer.current.paint(texture, camera, up, look)
      else {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
        if (texture) paintGlobe(canvas, texture, camera, up, look, true)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [texture, camera, up, look, width, height])
  const ratio = Math.min(window.devicePixelRatio || 1, 2, 1600 / Math.max(width, height))
  return <div style={{ width, height, position: 'relative' }}>
    <canvas ref={ref} width={Math.max(1, Math.round(width * ratio))} height={Math.max(1, Math.round(height * ratio))} aria-label="地球球面" style={{ width: '100%', height: '100%' }} />
    {failed && <span role="status" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#ffffff' }}>地球纹理未能加载</span>}
  </div>
}
