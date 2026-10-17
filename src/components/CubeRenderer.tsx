import type { CubeElement } from '../types'

interface CubeRendererProps {
  element: CubeElement
  scale: number
}

interface Point3D {
  x: number
  y: number
  z: number
}

interface ProjectedPoint {
  x: number
  y: number
  z: number
}

function project(
  p: Point3D,
  yawDeg: number,
  pitchDeg: number,
  cx: number,
  cy: number
): ProjectedPoint {
  const yaw = (yawDeg * Math.PI) / 180
  const pitch = (pitchDeg * Math.PI) / 180

  // 1. Yaw rotation (around Y axis)
  const x1 = p.x * Math.cos(yaw) + p.z * Math.sin(yaw)
  const y1 = p.y
  const z1 = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw)

  // 2. Pitch rotation (around X axis)
  const x2 = x1
  const y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch)
  const z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch)

  return { x: cx + x2, y: cy + y2, z: z2 }
}

/**
 * 具有真正三维正交/透视投影、表面光照与背面虚线消隐的立方体渲染器
 */
export function CubeRenderer({ element, scale }: CubeRendererProps) {
  const {
    x,
    y,
    width,
    height,
    rotation = 0,
    edgeThickness = 1.5,
    edgeColor = '#333333',
    topFillColor = 'rgba(219, 234, 254, 0.65)',
    frontFillColor = 'rgba(147, 197, 253, 0.65)',
    rightFillColor = 'rgba(96, 165, 250, 0.65)'
  } = element

  const strokeWidth = Math.max(1, edgeThickness * scale)
  const dashSize = Math.max(4, strokeWidth * 3)

  // 3D 尺寸
  const sizeX = width * 0.65
  const sizeY = height * 0.65
  const sizeZ = Math.min(width, height) * 0.65

  // 投影视角 (与希沃 HelixToolkit 默认相机方位角相近：水平 30度，俯视 22度)
  const yaw = 32
  const pitch = -22

  const cx = width / 2
  const cy = height / 2

  // 8 个立方体顶点（局部中心为原点）
  const hx = sizeX / 2
  const hy = sizeY / 2
  const hz = sizeZ / 2

  const rawVertices: Point3D[] = [
    { x: -hx, y: -hy, z: hz }, // 0: 前左上
    { x: hx, y: -hy, z: hz },  // 1: 前右上
    { x: hx, y: hy, z: hz },   // 2: 前右下
    { x: -hx, y: hy, z: hz },  // 3: 前左下
    { x: -hx, y: -hy, z: -hz },// 4: 后左上
    { x: hx, y: -hy, z: -hz }, // 5: 后右上
    { x: hx, y: hy, z: -hz },  // 6: 后右下
    { x: -hx, y: hy, z: -hz }  // 7: 后左下
  ]

  const projected = rawVertices.map(v => project(v, yaw, pitch, cx, cy))

  // 6 个表面及其法向量朝向判断（通过 2D 投影多边形卷绕方向判断是否为可视面）
  const faces = [
    { indices: [0, 1, 2, 3], fill: frontFillColor, name: 'front' },
    { indices: [4, 0, 3, 7], fill: frontFillColor, name: 'left' },
    { indices: [1, 5, 6, 2], fill: rightFillColor, name: 'right' },
    { indices: [4, 5, 1, 0], fill: topFillColor, name: 'top' },
    { indices: [3, 2, 6, 7], fill: topFillColor, name: 'bottom' },
    { indices: [5, 4, 7, 6], fill: rightFillColor, name: 'back' }
  ]

  // 计算各面法线朝向以确定可见性 (Screen-space cross product)
  const faceVisibility = faces.map(face => {
    const p0 = projected[face.indices[0]]
    const p1 = projected[face.indices[1]]
    const p2 = projected[face.indices[2]]
    const cross = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x)
    return cross > 0
  })

  // 12 条棱边
  const edges: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 0], // 前面4边
    [4, 5], [5, 6], [6, 7], [7, 4], // 后面4边
    [0, 4], [1, 5], [2, 6], [3, 7]  // 连接前后4边
  ]

  // 判断每条棱边是否属于至少一个可见面（若属于可见面则实线，若仅属于不可见面则虚线）
  const edgeVisibility = edges.map(([v1, v2]) => {
    let isVisible = false
    faces.forEach((face, fIndex) => {
      if (faceVisibility[fIndex]) {
        const inFace =
          face.indices.includes(v1) &&
          face.indices.includes(v2) &&
          (Math.abs(face.indices.indexOf(v1) - face.indices.indexOf(v2)) === 1 ||
            Math.abs(face.indices.indexOf(v1) - face.indices.indexOf(v2)) === face.indices.length - 1)
        if (inFace) isVisible = true
      }
    })
    return isVisible
  })

  return (
    <div
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center'
      }}
    >
      <svg
        width={width * scale}
        height={height * scale}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* 先渲染不可见的消隐背面虚线 */}
        {edges.map(([v1, v2], idx) => {
          if (edgeVisibility[idx]) return null
          const p1 = projected[v1]
          const p2 = projected[v2]
          return (
            <line
              key={`hidden-edge-${idx}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={edgeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashSize} ${dashSize}`}
              strokeLinecap='round'
            />
          )
        })}

        {/* 渲染可见表面多边形 */}
        {faces.map((face, fIdx) => {
          if (!faceVisibility[fIdx]) return null
          const pathData =
            face.indices
              .map((vIdx, i) => `${i === 0 ? 'M' : 'L'} ${projected[vIdx].x.toFixed(2)} ${projected[vIdx].y.toFixed(2)}`)
              .join(' ') + ' Z'

          return (
            <path
              key={`face-${fIdx}`}
              d={pathData}
              fill={face.fill}
              stroke='none'
            />
          )
        })}

        {/* 渲染外露可见棱边实线 */}
        {edges.map(([v1, v2], idx) => {
          if (!edgeVisibility[idx]) return null
          const p1 = projected[v1]
          const p2 = projected[v2]
          return (
            <line
              key={`visible-edge-${idx}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={edgeColor}
              strokeWidth={strokeWidth}
              strokeLinecap='round'
            />
          )
        })}
      </svg>
    </div>
  )
}
