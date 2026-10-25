import type { StaticDrawing } from './staticPlan'

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent) => void) | null
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

workerScope.onmessage = (event: MessageEvent<{
  id: number; width: number; height: number; ratio: number; drawings: StaticDrawing[]
}>) => {
  const { id, width, height, ratio, drawings } = event.data
  try {
    const canvas = new OffscreenCanvas(Math.ceil(width * ratio), Math.ceil(height * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建离屏画布')
    context.scale(ratio, ratio)
    for (const drawing of drawings) {
      if (drawing.fill === 'none' || drawing.fill === 'transparent') continue
      const { geometry, width: w, height: h } = drawing
      context.save()
      context.translate(drawing.x + w / 2, drawing.y + h / 2)
      context.rotate(drawing.rotation * Math.PI / 180)
      context.scale(drawing.flipX ? -1 : 1, drawing.flipY ? -1 : 1)
      context.translate(-w / 2, -h / 2)
      // 官方气泡尾部、方框引线等允许超出元素局部矩形。
      context.translate(geometry.pathTranslateX, geometry.pathTranslateY)
      context.scale(geometry.pathScaleX, geometry.pathScaleY)
      context.fillStyle = drawing.fill
      for (const path of drawing.paths) context.fill(new Path2D(path.path), path.fillRule)
      context.restore()
    }
    const bitmap = canvas.transferToImageBitmap()
    workerScope.postMessage({ id, bitmap }, [bitmap])
  } catch (error) {
    workerScope.postMessage({ id, error: String(error) })
  }
}
