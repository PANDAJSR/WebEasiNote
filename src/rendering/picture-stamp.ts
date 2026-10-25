export type StampSide = 'top' | 'bottom' | 'left' | 'right'
export interface StampTile { x: number; y: number; width: number; height: number; points?: number[][]; repeat?: boolean }

/** TiledBrushImage：中段平铺，首尾以一像素重叠的斜切拼接；末片按几何边界映射画刷。 */
export function pictureStampTiles(side: StampSide, width: number, height: number): StampTile[] {
  // 官方四张 24×24 资源之和；过小时不绘制平铺装饰，白边仍保留。
  if (width < 96 || height < 96) return []
  const horizontal = side === 'top' || side === 'bottom'
  const length = horizontal ? width : height
  const start = (Math.ceil(length / 24) - 1) * 24
  const tail = length - start
  const tile = (pos: number, size: number, points?: number[][], repeat = false): StampTile => ({
    x: horizontal ? pos : side === 'right' ? width : 0,
    y: horizontal ? side === 'bottom' ? height : 0 : pos,
    width: horizontal ? size : 24, height: horizontal ? 24 : size, points, repeat
  })
  const first = side === 'top' ? [[23, 24], [24, 24], [24, 0], [0, 0], [0, 1]]
    : side === 'bottom' || side === 'right' ? [[23, 0], [24, 0], [24, 24], [0, 24], [0, 23]]
      : [[1, 0], [0, 0], [0, 24], [24, 24], [24, 23]]
  const end1 = side === 'top' || side === 'left'
    ? [[0, 0], [0, 24], [tail + 1, 24], [24, tail + 1], [24, 0]]
    : side === 'bottom' ? [[0, 0], [0, 24], [24, 24], [24, 23 - tail], [tail + 1, 0]]
      : [[0, 0], [0, tail + 1], [23 - tail, 24], [24, 24], [24, 0]]
  const end2 = side === 'top' ? [[0, 0], [0, tail + 1], [tail, 1], [tail, 0]]
    : side === 'bottom' ? [[0, 24], [tail, 24], [tail, 23], [0, 23 - tail]]
      : side === 'left' ? [[0, 0], [0, tail], [1, tail], [tail + 1, 0]]
        : [[24, 0], [23 - tail, 0], [23, tail], [24, tail]]
  return [tile(0, 24, first), tile(24, start - 24, undefined, true),
    tile(start, 24, end1), tile(start + 24, tail, end2)]
}
