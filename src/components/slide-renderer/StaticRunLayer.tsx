import { useLayoutEffect, useRef, useState } from 'react'
import type { StaticRun } from '../../rendering/staticPlan'
import { acquireRaster, copyCachedRaster, hasCachedRaster, rasterRatio } from '../../rendering/rasterCache'
import { ShapeRenderer } from '../ShapeRenderer'

interface StaticRunLayerProps {
  run: StaticRun
  width: number
  height: number
  scale: number
}

export function StaticRunLayer({ run, width, height, scale }: StaticRunLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ratio = rasterRatio(scale, window.devicePixelRatio || 1, width, height)
  const [ready, setReady] = useState(() => hasCachedRaster(run, width, height, ratio))
  useLayoutEffect(() => {
    let disposed = false
    const canvas = canvasRef.current
    if (canvas && copyCachedRaster(run, width, height, ratio, canvas)) {
      setReady(true)
    } else {
      setReady(false)
      acquireRaster(run, width, height, ratio).then(lease => {
        try {
          if (disposed || !canvasRef.current) return
          const canvas = canvasRef.current
          const context = canvas.getContext('2d')
          if (!context) return
          canvas.width = lease.bitmap.width
          canvas.height = lease.bitmap.height
          context.drawImage(lease.bitmap, 0, 0)
          setReady(true)
        } finally {
          lease.release()
        }
      }).catch(error => {
        if (!disposed) console.warn('[StaticRunLayer] 缓存不可用，保留矢量绘制', error)
      })
    }
    return () => {
      disposed = true
      // 立即释放页面自有画布的像素存储。
      if (canvas) canvas.width = canvas.height = 0
    }
  }, [run, width, height, ratio])
  return (
    <>
      <canvas ref={canvasRef} data-static-run={run.elements.length}
        style={{ position: 'absolute', left: 0, top: 0, width, height,
          pointerEvents: 'none', visibility: ready ? 'visible' : 'hidden' }} />
      {!ready && run.elements.map(element => element.type === 'shape'
        ? <ShapeRenderer key={element.id} element={element} scale={1} /> : null)}
    </>
  )
}
