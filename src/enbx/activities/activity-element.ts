import type { ActivityElement, SlideElement, SlideIssue } from '../../types'
import { parseBrush } from '../brushes'
import { parseRichTextNode } from '../text-parser'
import { getDirectChildElement as child } from '../xml-utils'
import { subjectBounds, subjectNumber as number, subjectText as text } from '../subject-xml'

type ParseContents = (node: Element) => { elements: SlideElement[]; issues: SlideIssue[] }

export function parseActivityElement(node: Element, parseContents: ParseContents) {
  const bounds = subjectBounds(node)
  const resourceType = text(node, 'ResourceType')
  const role: ActivityElement['role'] = ({ '0': 'background', Background: 'background',
    '1': 'container', Container: 'container', '2': 'material', Material: 'material' } as const)[resourceType] || 'unknown'
  const savedText = child(node, 'RichText') || child(node, 'Text')
  // ActivityItem.RichText 的类型是 TextSaveInfo，里面仍有一层 RichText。
  const richText = savedText && (child(savedText, 'RichText') || savedText)
  const contents = child(node, 'Contents')
  const parsed = contents ? parseContents(contents) : { elements: [], issues: [] }
  const horizontal = text(node, 'TextHorizontalAlignment') || text(node, 'HorizontalAlignment') || 'Center'
  const vertical = text(node, 'TextVerticalAlignment') || text(node, 'VerticalAlignment') || 'Center'
  const parsedText = richText ? parseRichTextNode(richText) : undefined
  const editorWidth = number(node, 'TextEditorWidth')
  const width = editorWidth > 0 ? editorWidth : Math.max(1, bounds.width - 20)
  const element: ActivityElement = {
    ...bounds, type: 'activity', activityId: text(node, 'ActivityId'), resourceId: text(node, 'ResourceId'), role,
    background: parseBrush(child(node, 'Background')) || undefined,
    stroke: parseBrush(child(node, 'Stroke')) || undefined,
    strokeThickness: number(node, 'StrokeThickness'), roundRadius: number(node, 'RoundRadius'),
    contents: parsed.elements,
    text: parsedText ? { ...bounds, ...parsedText, type: 'text', id: `${bounds.id}:text`, rotation: 0,
      width, x: (horizontal === 'Left' || horizontal === '0' ? 0
        : horizontal === 'Right' || horizontal === '2' ? bounds.width - width : (bounds.width - width) / 2)
        + number(node, 'TextHorizontalOffset', number(node, 'HorizontalOffset')),
      y: number(node, 'TextVerticalOffset', number(node, 'VerticalOffset')),
      verticalTextAlignment: vertical === 'Top' || vertical === '0' ? 'Top'
        : vertical === 'Bottom' || vertical === '2' ? 'Bottom' : 'Center',
      textLines: parsedText.textLines } : undefined
  }
  return { element, issues: parsed.issues }
}
