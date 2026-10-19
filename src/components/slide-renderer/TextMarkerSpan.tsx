import type { TextLine } from '../../types'
import type { ResolvedTextMarker } from '../../text/text-markers'

export function TextMarkerSpan({ marker, line, scale, absoluteLeft }: {
  marker: ResolvedTextMarker
  line: TextLine
  scale: number
  absoluteLeft?: number
}) {
  const absolute = absoluteLeft !== undefined
  return (
    <span style={{
      display: absolute ? undefined : 'inline-block',
      position: absolute ? 'absolute' : undefined,
      left: absoluteLeft,
      top: absolute ? 0 : undefined,
      minWidth: absolute ? (line.indent || line.marginLeft || 0) * scale : undefined,
      marginRight: absolute ? undefined : `${8 * scale}px`,
      fontFamily: marker.fontFamily,
      fontSize: (line.textMarkerStyle?.fontSize || line.textRuns[0]?.fontSize || 16) * scale,
      fontSynthesis: 'style weight',
      lineHeight: 'inherit',
      whiteSpace: absolute ? 'pre' : undefined,
      verticalAlign: absolute ? undefined : 'baseline'
    }}>
      {marker.text}
    </span>
  )
}
