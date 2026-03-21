import JSZip from 'jszip'
import type { SlideData, SlideElement } from './parser'
import { getDirectChildText } from './xml-utils'

interface SlideEditPatch {
  slideId: string
  elementId: string
  rawXml: string
}

function parseXmlDocument(xmlContent: string): Document {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml')
  if (xmlDoc.querySelector('parsererror')) {
    throw new Error('XML 格式有误，无法导出')
  }
  return xmlDoc
}

function findElementNodeById(root: Element, elementId: string): Element | null {
  if (getDirectChildText(root, 'Id') === elementId) return root
  for (const child of Array.from(root.children)) {
    const found = findElementNodeById(child, elementId)
    if (found) return found
  }
  return null
}

function replaceElementXml(slideXml: string, patches: SlideEditPatch[]): string {
  if (patches.length === 0) return slideXml
  const slideDoc = parseXmlDocument(slideXml)
  const slideRoot = slideDoc.documentElement

  patches.forEach(patch => {
    const targetNode = findElementNodeById(slideRoot, patch.elementId)
    if (!targetNode || !targetNode.parentNode) return

    const editedElementDoc = parseXmlDocument(patch.rawXml)
    const editedElementNode = editedElementDoc.documentElement
    targetNode.parentNode.replaceChild(slideDoc.importNode(editedElementNode, true), targetNode)
  })

  return new XMLSerializer().serializeToString(slideDoc)
}

function collectSlideEditPatches(editedElements: Record<string, SlideElement>): Record<string, SlideEditPatch[]> {
  const patchMap: Record<string, SlideEditPatch[]> = {}

  Object.entries(editedElements).forEach(([mapKey, element]) => {
    if (!element.rawXml) return

    const delimiterIndex = mapKey.indexOf('|')
    if (delimiterIndex === -1) return
    const slideId = mapKey.slice(0, delimiterIndex)
    const elementId = mapKey.slice(delimiterIndex + 1)
    if (!slideId || !elementId) return

    if (!patchMap[slideId]) {
      patchMap[slideId] = []
    }
    patchMap[slideId].push({
      slideId,
      elementId,
      rawXml: element.rawXml
    })
  })

  return patchMap
}

function readSlideIdFromXml(xmlContent: string): string {
  const doc = parseXmlDocument(xmlContent)
  return getDirectChildText(doc.documentElement, 'Id') || ''
}

function toSafeFileName(name: string): string {
  const trimmed = name.trim() || 'courseware'
  return trimmed.replace(/[\\/:*?"<>|]/g, '_')
}

export async function exportSlidesToEnbx(options: {
  sourceFile: File
  slides: SlideData[]
  editedElements: Record<string, SlideElement>
  coursewareName: string
}): Promise<{ fileName: string; blob: Blob }> {
  const { sourceFile, slides, editedElements, coursewareName } = options
  const zip = await JSZip.loadAsync(sourceFile)
  const patchMap = collectSlideEditPatches(editedElements)
  const slideXmlMap = new Map<string, string>()

  slides.forEach(slide => {
    if (!slide.rawXml) return
    const patches = patchMap[slide.id] || []
    slideXmlMap.set(slide.id, replaceElementXml(slide.rawXml, patches))
  })

  const slidePaths: string[] = []
  zip.forEach(relativePath => {
    if (relativePath.startsWith('Slides/Slide_') && relativePath.endsWith('.xml')) {
      slidePaths.push(relativePath)
    }
  })

  for (const slidePath of slidePaths) {
    const slideFile = zip.file(slidePath)
    if (!slideFile) continue
    const currentSlideXml = await slideFile.async('text')
    const slideId = readSlideIdFromXml(currentSlideXml)
    const updatedXml = slideXmlMap.get(slideId)
    if (!updatedXml) continue
    zip.file(slidePath, updatedXml)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const fileName = `${toSafeFileName(coursewareName)}-edited.enbx`

  return {
    fileName,
    blob
  }
}
