import type { ShapePathItem } from './shapes'
import { isTransparentPaint, normalizeSeewoPath } from './seewo-path'

const dark = 'rgba(0, 0, 0, 0.19607843137254902)'
const light = 'rgba(255, 255, 255, 0.09803921568627451)'

/** 对应官方各形状 OnRender / GetShapePath 的分层顺序。 */
export function buildShapeLayers(type: string, raw: string, foreground: string): ShapePathItem[] | undefined {
  const figures = normalizeSeewoPath(raw).path.match(/[Mm][^Mm]*/g) || []
  const layer = (path: string, fill?: string): ShapePathItem => ({
    path, fill, isFilled: true, isStroke: true, fillRule: 'nonzero'
  })
  switch (type.toLowerCase()) {
    case 'smilingface': {
      const groups = raw.split(/F[01]/i).filter(part => part.trim()).map(part => normalizeSeewoPath(part).path)
      if (groups.length !== 3) return undefined
      const detail = isTransparentPaint(foreground) ? '#ffffff' : foreground
      return [layer(groups[0]), layer(groups[1], detail), layer(groups[2], detail)]
    }
    case 'fire':
      if (figures.length === 2) return [layer(figures[0]), layer(figures[1], 'rgba(255, 255, 255, 0.2980392156862745)')]
      break
    case 'medal':
      if (figures.length === 7) return [
        layer(figures[0]), layer(figures[3]), layer(figures[4]),
        layer(figures[1], dark), layer(figures[2], light), layer(figures[5], dark), layer(figures[6], dark)
      ]
      break
    case 'scroll':
      if (figures.length === 5) return figures.map((path, i) => layer(path, i === 0 ? undefined : i % 2 ? light : dark))
      break
    case 'banner':
      if (figures.length === 5) return figures.map((path, i) => layer(path,
        i === 0 ? undefined : i < 3 ? 'rgba(0, 0, 0, 0.29411764705882354)' : 'rgba(0, 0, 0, 0.39215686274509803)'))
      break
    case 'rotationarrow':
      if (figures.length === 2) return [layer(figures[0]), layer(figures[1]), layer(figures[1], dark)]
      break
  }
  return undefined
}
