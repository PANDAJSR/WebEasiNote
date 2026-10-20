import type { ChartElement, ChartLabel } from '../../types'

function niceStep(value: number) {
  const unit = 10 ** Math.floor(Math.log10(Math.max(value, .0001)))
  return [1, 2, 5, 10].map(n => n * unit).find(n => n >= value) || unit * 10
}
export function ChartRenderer({ element, scale }: { element: ChartElement; scale: number }) {
  const { width, height, data } = element
  const color = (i: number) => element.colors[i % Math.max(1, element.colors.length)] || '#00c881'
  const labels = (label: ChartLabel, x: number, y: number, anchor: 'middle' | 'start' | 'end' = 'middle') =>
    <text x={x} y={y} fill={label.color} fontSize={label.fontSize} textAnchor={anchor} dominantBaseline="middle">{label.text}</text>
  const pie = element.chartType === 'Pie'
  const bottom = height - 32
  const left = 42
  const top = 10
  const plotWidth = width - left - 18
  const plotHeight = bottom - top
  const values = data.flatMap(row => row.values.map(v => Number(v.text))).filter(Number.isFinite)
  const step = niceStep(Math.max(...values, 1) / 5)
  const maximum = Math.ceil(Math.max(...values, 1) / step) * step
  const minimum = Math.min(0, Math.floor(Math.min(...values, 0) / step) * step)
  const y = (v: number) => bottom - (v - minimum) / (maximum - minimum) * plotHeight
  // Data 中每个 ChartData 是类别，每个 Values 下标是系列；DataType 是编辑数据表的方向。
  const seriesCount = Math.max(0, ...data.map(row => row.values.length))
  const categoryWidth = plotWidth / Math.max(data.length, 1)
  const barWidth = categoryWidth * .65 / Math.max(seriesCount, 1)
  const total = data.reduce((sum, row) => sum + Math.max(0, Number(row.values[0]?.text) || 0), 0)
  const legend = pie ? data.map(row => ({ ...row.title, color: element.legend[0]?.color || '#666666', fontSize: element.legend[0]?.fontSize || 14 })) : element.legend
  const legendWidths = legend.map(label => 26 + [...label.text].reduce((sum, c) => sum + label.fontSize * (c.charCodeAt(0) > 255 ? 1 : .5), 0) + 15)
  const legendSize = legendWidths.reduce((sum, value) => sum + value, 0) - 15
  let legendX = ((element.legendWidth || 500) - legendSize) / 2
  let angle = -Math.PI / 2
  return <div aria-label={`${element.chartType} 图表`} style={{ position: 'absolute', left: element.x * scale,
    top: element.y * scale, width: width * scale, height: height * scale,
    transform: `rotate(${element.rotation}deg)`, transformOrigin: 'center center', pointerEvents: 'none' }}>
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', fontFamily: '"Microsoft YaHei", sans-serif' }}>
      {element.legendVisible && <g transform={`translate(${element.legendLocation[0] ?? 0},${(element.legendLocation[1] ?? -50) + 25})`}>
        {legend.map((label, index) => {
          const x = legendX
          legendX += legendWidths[index]
          return <g key={index} transform={`translate(${x},0)`}>
            <rect x="0" y="-10.5" width="21" height="21" fill={color(index)} />{labels(label, 26, 0, 'start')}
          </g>
        })}
      </g>}
      {pie ? data.map((row, index) => {
        const fraction = total > 0 ? Math.max(0, Number(row.values[0]?.text) || 0) / total : 0
        const start = angle
        angle += fraction * Math.PI * 2
        const radius = Math.min(width, height) / 2
        const point = (a: number, r: number) => [width / 2 + Math.cos(a) * r, height / 2 + Math.sin(a) * r]
        const a = point(start, radius)
        const b = point(angle, radius)
        const mid = point((start + angle) / 2, radius * .75)
        return <g key={index}><path d={fraction >= 1 ? `M${width / 2 - radius} ${height / 2}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
          : `M${width / 2} ${height / 2}L${a.join(' ')}A${radius} ${radius} 0 ${fraction > .5 ? 1 : 0} 1 ${b.join(' ')}Z`} fill={color(index)} />
          {element.dataTagVisible && fraction > 0 && labels({ ...row.values[0], text: `${Math.round(fraction * 100)}%` }, mid[0], mid[1])}</g>
      }) : <>
        {Array.from({ length: Math.min(20, Math.round((maximum - minimum) / step) + 1) }, (_, index) => minimum + index * step).map(value =>
          <g key={value}><path d={`M${left} ${y(value)}H${width - 18}`} stroke={element.coordinateColor} fill="none" />
            <text x={left - 12} y={y(value)} textAnchor="end" dominantBaseline="middle" fill="#666666" fontSize="14">{value}</text></g>)}
        {data.map((row, index) => <g key={index}>{labels(row.title, left + categoryWidth * (index + .5), height - 10)}</g>)}
        {Array.from({ length: seriesCount }, (_, series) => <g key={series}>
          {element.chartType === 'Line' && <polyline fill="none" stroke={color(series)} strokeWidth="3"
            points={data.map((row, i) => `${left + categoryWidth * (i + .5)},${y(Number(row.values[series]?.text) || 0)}`).join(' ')} />}
          {data.map((row, i) => {
            const label = row.values[series]
            if (!label || !Number.isFinite(Number(label.text))) return null
            const value = Number(label.text)
            const line = element.chartType === 'Line'
            const x = left + categoryWidth * (i + .5) + (line ? 0 : (series - seriesCount / 2) * barWidth)
            return <g key={i}>{line ? <circle cx={x} cy={y(value)} r="4" fill={color(series)} />
              : <rect x={x} y={Math.min(y(value), y(0))} width={barWidth - 2} height={Math.abs(y(0) - y(value))} fill={color(series)} />}
              {element.dataTagVisible && labels(label, x + (line ? 0 : (barWidth - 2) / 2), y(value) - 14)}</g>
          })}
        </g>)}
      </>}
    </svg>
  </div>
}
