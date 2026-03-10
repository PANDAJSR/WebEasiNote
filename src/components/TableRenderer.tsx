import type { CSSProperties } from 'react'
import type { TableElement, TextRun } from '../types'
import { buildFontFamily } from '../font-utils'

interface TableRendererProps {
  element: TableElement
  scale: number
}

function getTextAlign(value: string | undefined): CSSProperties['textAlign'] {
  if (value === 'Center') return 'center'
  if (value === 'Right') return 'right'
  return 'left'
}

function getRunColor(run: TextRun): string {
  if (run.opacity === undefined) return run.color
  const opacity = Math.min(1, Math.max(0, run.opacity))
  if (run.color.startsWith('rgba(')) {
    return run.color.replace(
      /,\s*([0-9.]+)\)$/,
      (_, alpha) => `, ${(parseFloat(alpha) * opacity).toFixed(2)})`
    )
  }
  if (run.color.startsWith('rgb(')) {
    return run.color.replace('rgb(', 'rgba(').replace(')', `, ${opacity.toFixed(2)})`)
  }
  if (run.color.startsWith('#') && run.color.length === 7) {
    const r = parseInt(run.color.slice(1, 3), 16)
    const g = parseInt(run.color.slice(3, 5), 16)
    const b = parseInt(run.color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`
  }
  return run.color
}

function renderCellContent(element: TableElement, rowIndex: number, cellIndex: number, scale: number) {
  const cell = element.rows[rowIndex][cellIndex]
  return (
    <div>
      {cell.textLines.map((line, lineIndex) => (
        <div
          key={`${lineIndex}`}
          style={{
            lineHeight: '1.2',
            marginBottom: lineIndex === cell.textLines.length - 1 ? 0 : 2 * scale,
            textAlign: getTextAlign(line.textAlignment)
          }}
        >
          {line.textRuns.map((run, runIndex) => (
            <span
              key={`${lineIndex}-${runIndex}`}
              style={{
                fontFamily: buildFontFamily(run.fontFamily),
                fontSize: run.fontSize * scale,
                fontStyle: run.fontStyle,
                fontWeight: run.fontWeight,
                color: getRunColor(run),
                textDecoration: run.decoration === 'Underline' ? 'underline' : 'none',
                whiteSpace: 'pre-wrap'
              }}
            >
              {run.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * 表格元素渲染器
 */
export function TableRenderer({ element, scale }: TableRendererProps) {
  const totalColumnWidth = element.columnWidths.reduce((sum, width) => sum + width, 0)

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x * scale,
        top: element.y * scale,
        width: element.width * scale,
        height: element.height * scale,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: 'top left',
        overflow: 'hidden'
      }}
    >
      <table
        style={{
          width: '100%',
          height: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed'
        }}
      >
        <colgroup>
          {element.columnWidths.map((width, index) => {
            const relativeWidth = totalColumnWidth > 0
              ? (width / totalColumnWidth) * 100
              : 100 / Math.max(1, element.columnWidths.length)
            return <col key={index} style={{ width: `${relativeWidth}%` }} />
          })}
        </colgroup>
        <tbody>
          {element.rows.map((row, rowIndex) => {
            const rowHeight = element.rowHeights[rowIndex]
            const rowFillColor = rowIndex === 0
              ? element.headerFillColor
              : element.rowFillColors.length > 0
                ? element.rowFillColors[(rowIndex - 1) % element.rowFillColors.length]
                : undefined

            return (
              <tr key={rowIndex} style={rowHeight > 0 ? { height: rowHeight * scale } : undefined}>
                {row.map((cell, cellIndex) => {
                  if (cell.hMerged || cell.vMerged) return null
                  return (
                    <td
                      key={cellIndex}
                      rowSpan={cell.rowSpan}
                      colSpan={cell.columnSpan}
                      style={{
                        border: `${Math.max(1, element.strokeThickness * scale)}px solid ${element.strokeColor}`,
                        padding: `${element.cellVPadding * scale}px ${element.cellHPadding * scale}px`,
                        backgroundColor: rowFillColor,
                        verticalAlign: 'top',
                        overflowWrap: 'break-word'
                      }}
                    >
                      {renderCellContent(element, rowIndex, cellIndex, scale)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
