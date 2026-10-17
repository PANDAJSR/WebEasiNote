import type { TableCell, TableElement } from './types'
import { parseTextElement } from './text-parser'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'
import { parseBrush, brushToCss } from './brushes'

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseBoolean(value: string | null): boolean {
  return (value || '').trim().toLowerCase() === 'true'
}

function parseColorFromNode(node: Element | null | undefined): string | undefined {
  if (!node) return undefined
  const brush = parseBrush(node)
  if (brush) {
    return brushToCss(brush, undefined, undefined)
  }
  const color = node.querySelector('ColorBrush')?.textContent
  if (!color) return undefined
  return parseColor(color)
}

function parseRowSkinFillColors(tableNode: Element): string[] {
  const rowSkinNodes = tableNode.querySelectorAll('Skin > RowSkins > RowSkinDetail')
  return Array.from(rowSkinNodes)
    .map(node => parseColorFromNode(node.querySelector('Fill')))
    .filter((color): color is string => !!color)
}

function parseCell(cellNode: Element): TableCell {
  const textNode = getDirectChildElement(cellNode, 'Text')
  const textElement = textNode ? parseTextElement(textNode) : null

  // 1. 解析单元格独立背景 (最高优先级覆盖行列斑马纹)
  const backgroundNode = getDirectChildElement(cellNode, 'Background')
  const backgroundBrush = parseBrush(backgroundNode)
  const background = backgroundBrush ? brushToCss(backgroundBrush, undefined, undefined) : undefined

  // 2. 解析垂直对齐方式
  const vertAlignRaw =
    cellNode.getAttribute('VerticalAlignment') ||
    getDirectChildText(cellNode, 'VerticalAlignment') ||
    textElement?.verticalTextAlignment ||
    'Center'
  const verticalAlignment =
    vertAlignRaw === 'Top' || vertAlignRaw === 'Bottom' || vertAlignRaw === 'Center'
      ? vertAlignRaw
      : 'Center'

  return {
    rowSpan: Math.max(1, parseInt(getDirectChildText(cellNode, 'RowSpan') || '1', 10)),
    columnSpan: Math.max(1, parseInt(getDirectChildText(cellNode, 'ColumnSpan') || '1', 10)),
    hMerged: parseBoolean(getDirectChildText(cellNode, 'HMerged')),
    vMerged: parseBoolean(getDirectChildText(cellNode, 'VMerged')),
    background,
    backgroundBrush: backgroundBrush || undefined,
    verticalAlignment,
    textLines: textElement?.textLines || []
  }
}

/**
 * 解析表格元素
 */
export function parseTableElement(tableNode: Element): TableElement | null {
  try {
    const id = getDirectChildText(tableNode, 'Id') || 'unknown'

    const x = parseNumber(getDirectChildText(tableNode, 'X'))
    const y = parseNumber(getDirectChildText(tableNode, 'Y'))
    const width = parseNumber(getDirectChildText(tableNode, 'Width'), 100)
    const height = parseNumber(getDirectChildText(tableNode, 'Height'), 60)
    const rotation = parseNumber(getDirectChildText(tableNode, 'Rotation'))

    // 官方默认 CellHPadding/CellVPadding 具有标准间距
    const cellHPadding = parseNumber(getDirectChildText(tableNode, 'CellHPadding'), 14)
    const cellVPadding = parseNumber(getDirectChildText(tableNode, 'CellVPadding'), 10)

    const strokeThickness = parseNumber(tableNode.querySelector('Skin > StrokeThickness')?.textContent || null, 1)
    const strokeColor = parseColorFromNode(tableNode.querySelector('Skin > Stroke')) || '#adadad'
    const headerFillColor = parseColorFromNode(tableNode.querySelector('Skin > HeaderFill'))
    const rowFillColors = parseRowSkinFillColors(tableNode)

    const columnWidthsNode = getDirectChildElement(tableNode, 'ColumnWidths')
    const columnWidths = columnWidthsNode
      ? Array.from(columnWidthsNode.children)
          .filter(child => child.tagName === 'Item')
          .map(child => parseNumber(child.textContent, 0))
      : []

    const rowHeights: number[] = []
    const rows: TableCell[][] = []
    const rowsNode = getDirectChildElement(tableNode, 'Rows')

    if (rowsNode) {
      const rowNodes = Array.from(rowsNode.children).filter(node => node.tagName === 'Row')

      rowNodes.forEach(rowNode => {
        rowHeights.push(parseNumber(getDirectChildText(rowNode, 'Height'), 0))

        const cellsNode = getDirectChildElement(rowNode, 'Cells')
        if (!cellsNode) {
          rows.push([])
          return
        }

        const cellNodes = Array.from(cellsNode.children).filter(node => node.tagName === 'Cell')
        rows.push(cellNodes.map(parseCell))
      })
    }

    return {
      type: 'table',
      id,
      x,
      y,
      width,
      height,
      rotation,
      cellHPadding,
      cellVPadding,
      strokeThickness,
      strokeColor,
      headerFillColor,
      rowFillColors,
      columnWidths,
      rowHeights,
      rows
    }
  } catch (error) {
    console.error('[Table] 解析失败', error)
    return null
  }
}
