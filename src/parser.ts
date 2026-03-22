import JSZip from 'jszip';
import type {
  CoursewareMetadata,
  DocumentData,
  SlideData
} from './types';
import { parseXML, getElementText, getDirectChildElement, getDirectChildText, parseColor } from './xml-utils';
import { parseSlideElements } from './slide-elements-parser';
import { parseSlideAnimations } from './slide-animations'

export type {
CoursewareMetadata,
DocumentData,
SlideData,
TextElement,
TextLine,
TextRun,
ShapeElement,
  PictureElement,
  VideoElement,
  TableElement,
  TopicElement,
  CylinderElement,
  ConeElement,
  CubeElement,
  GeometryElement,
  MathFormulaElement,
  ElementAnimation,
  TableCell,
  UnknownElement,
  SlideIssue,
SlideElement
} from './types';
export { parseColor, formatDateTime } from './xml-utils';

/**
 * 解析ENBX文件（ZIP格式）
 */
export async function parseENBXFile(file: File): Promise<CoursewareMetadata> {
  try {
    const zip = await JSZip.loadAsync(file);
    
    // 读取 Board.xml 获取幻灯片列表
    const boardFile = zip.file('Board.xml');
    if (!boardFile) {
      throw new Error('无效的ENBX文件：缺少 Board.xml');
    }
    
    const boardXml = await boardFile.async('text');
    const boardData = parseXML(boardXml);
    
    // 读取 Document.xml 获取文档信息
    const docFile = zip.file('Document.xml');
    let docData: DocumentData | null = null;
    if (docFile) {
      const docXml = await docFile.async('text');
      docData = parseXML(docXml) as DocumentData;
    }
    
    // 获取幻灯片数量
    const slides = (boardData as { Slides?: { Item?: string | string[] } }).Slides?.Item || [];
    const slideCount = Array.isArray(slides) ? slides.length : 1;
    
    // 统计资源文件
    const resourceFiles: string[] = [];
    zip.forEach((relativePath, zipEntry) => {
      if (relativePath.startsWith('Resources/') && !zipEntry.dir) {
        resourceFiles.push(relativePath);
      }
    });
    
    return {
      type: 'enbx',
      name: docData?.Name || file.name.replace('.enbx', ''),
      creator: docData?.Creator || '未知',
      appVersion: docData?.AppVersion || '未知',
      documentVersion: docData?.DocumentVersion || '1.0',
      modifiedDate: docData?.ModifiedDateTime || null,
      slideCount,
      resourceCount: resourceFiles.length,
      resources: resourceFiles,
      slideIds: Array.isArray(slides) ? slides : [slides],
      raw: {
        board: boardData,
        document: docData
      }
    };
  } catch (error) {
    throw new Error(`解析ENBX文件失败: ${(error as Error).message}`);
  }
}

/**
 * 解析已解压的课件文件夹
 */
export async function parseExtractedFolder(dirHandle: FileSystemDirectoryHandle): Promise<CoursewareMetadata> {
  try {
    const files: Record<string, File> = {};
    
    // 遍历文件夹内容
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        files[entry.name] = file;
      }
    }
    
    // 读取 Board.xml
    if (!files['Board.xml']) {
      throw new Error('无效的课件文件夹：缺少 Board.xml');
    }
    
    const boardXml = await files['Board.xml'].text();
    const boardData = parseXML(boardXml);
    
    // 读取 Document.xml
    let docData: DocumentData | null = null;
    if (files['Document.xml']) {
      const docXml = await files['Document.xml'].text();
      docData = parseXML(docXml) as DocumentData;
    }
    
    // 获取幻灯片数量
    const slides = (boardData as { Slides?: { Item?: string | string[] } }).Slides?.Item || [];
    const slideCount = Array.isArray(slides) ? slides.length : 1;
    
    // 检查 Resources 文件夹
    let resourceCount = 0;
    try {
      const resourcesHandle = await dirHandle.getDirectoryHandle('Resources');
      for await (const entry of resourcesHandle.values()) {
        if (entry.kind === 'file') {
          resourceCount++;
        }
      }
    } catch {
      // Resources 文件夹可能不存在
    }
    
    // 检查 Slides 文件夹
    const slideFiles: string[] = [];
    try {
      const slidesHandle = await dirHandle.getDirectoryHandle('Slides');
      for await (const entry of slidesHandle.values()) {
        if (entry.kind === 'file' && entry.name.startsWith('Slide_')) {
          slideFiles.push(entry.name);
        }
      }
    } catch {
      // Slides 文件夹可能不存在
    }
    
    return {
      type: 'folder',
      name: docData?.Name || dirHandle.name,
      creator: docData?.Creator || '未知',
      appVersion: docData?.AppVersion || '未知',
      documentVersion: docData?.DocumentVersion || '1.0',
      modifiedDate: docData?.ModifiedDateTime || null,
      slideCount,
      resourceCount,
      slideFiles,
      slideIds: Array.isArray(slides) ? slides : [slides],
      raw: {
        board: boardData,
        document: docData
      }
    };
  } catch (error) {
    throw new Error(`解析文件夹失败: ${(error as Error).message}`);
  }
}

/**
 * 从ENBX文件加载幻灯片数据
 */
export async function loadSlidesFromENBX(file: File): Promise<SlideData[]> {
  const zip = await JSZip.loadAsync(file);
  const slides: SlideData[] = [];
  
  // 获取所有 Slide_*.xml 文件
  const slideFiles: string[] = [];
  zip.forEach((relativePath) => {
    if (relativePath.startsWith('Slides/Slide_') && relativePath.endsWith('.xml')) {
      slideFiles.push(relativePath);
    }
  });
  
  // 按文件名数值排序
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/Slide_(\d+)\.xml/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/Slide_(\d+)\.xml/)?.[1] || '0', 10);
    return numA - numB;
  });
  
  for (const slidePath of slideFiles) {
    const slideFile = zip.file(slidePath);
    if (!slideFile) continue;
    
    const slideXml = await slideFile.async('text');
    const slideData = parseSlideXML(slideXml);
    slides.push(slideData);
  }
  
  return slides;
}

/**
 * 从文件夹加载幻灯片数据
 */
export async function loadSlidesFromFolder(dirHandle: FileSystemDirectoryHandle): Promise<SlideData[]> {
  const slides: SlideData[] = [];
  
  try {
    const slidesHandle = await dirHandle.getDirectoryHandle('Slides');
    const slideFiles: string[] = [];
    
    for await (const entry of slidesHandle.values()) {
      if (entry.kind === 'file' && entry.name.startsWith('Slide_') && entry.name.endsWith('.xml')) {
        slideFiles.push(entry.name);
      }
    }
    
  // 按文件名数值排序
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/Slide_(\d+)\.xml/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/Slide_(\d+)\.xml/)?.[1] || '0', 10);
    return numA - numB;
  });
    
    for (const slideName of slideFiles) {
      const fileHandle = await slidesHandle.getFileHandle(slideName);
      const file = await fileHandle.getFile();
      const slideXml = await file.text();
      const slideData = parseSlideXML(slideXml);
      slides.push(slideData);
    }
  } catch {
    // Slides 文件夹可能不存在
  }
  
  return slides;
}

function findTagEnd(xml: string, fromIndex: number): number {
  let quoteChar: '"' | '\'' | null = null
  for (let i = fromIndex; i < xml.length; i++) {
    const char = xml[i]
    if (quoteChar) {
      if (char === quoteChar) quoteChar = null
      continue
    }
    if (char === '"' || char === '\'') {
      quoteChar = char
      continue
    }
    if (char === '>') return i
  }
  return -1
}

function extractTopLevelElementRawXml(slideXml: string): string[] {
  const elementsOpenTagMatch = slideXml.match(/<Elements(?:\s[^>]*)?>/)
  if (!elementsOpenTagMatch || typeof elementsOpenTagMatch.index !== 'number') return []

  const elementsStart = elementsOpenTagMatch.index
  const elementsOpenTag = elementsOpenTagMatch[0]
  const elementsContentStart = elementsStart + elementsOpenTag.length
  const elementsCloseTagIndex = slideXml.indexOf('</Elements>', elementsContentStart)
  if (elementsCloseTagIndex === -1) return []

  const innerXml = slideXml.slice(elementsContentStart, elementsCloseTagIndex)
  const topLevelFragments: string[] = []
  let index = 0

  while (index < innerXml.length) {
    const nextTagIndex = innerXml.indexOf('<', index)
    if (nextTagIndex === -1) break
    index = nextTagIndex

    if (innerXml.startsWith('<!--', index)) {
      const commentEnd = innerXml.indexOf('-->', index + 4)
      if (commentEnd === -1) break
      index = commentEnd + 3
      continue
    }
    if (innerXml.startsWith('<?', index)) {
      const declarationEnd = innerXml.indexOf('?>', index + 2)
      if (declarationEnd === -1) break
      index = declarationEnd + 2
      continue
    }
    if (innerXml.startsWith('</', index)) {
      const closeEnd = findTagEnd(innerXml, index + 2)
      if (closeEnd === -1) break
      index = closeEnd + 1
      continue
    }

    const openEnd = findTagEnd(innerXml, index + 1)
    if (openEnd === -1) break
    const openTagContent = innerXml.slice(index + 1, openEnd).trim()
    if (!openTagContent) {
      index = openEnd + 1
      continue
    }

    const isSelfClosing = /\/\s*$/.test(openTagContent)
    if (isSelfClosing) {
      topLevelFragments.push(innerXml.slice(index, openEnd + 1))
      index = openEnd + 1
      continue
    }

    const tagName = openTagContent
      .replace(/\/\s*$/, '')
      .split(/\s+/)[0]
      .trim()
    if (!tagName) {
      index = openEnd + 1
      continue
    }

    let depth = 1
    let cursor = openEnd + 1
    while (cursor < innerXml.length && depth > 0) {
      const childTagIndex = innerXml.indexOf('<', cursor)
      if (childTagIndex === -1) break

      if (innerXml.startsWith('<!--', childTagIndex)) {
        const commentEnd = innerXml.indexOf('-->', childTagIndex + 4)
        if (commentEnd === -1) break
        cursor = commentEnd + 3
        continue
      }
      if (innerXml.startsWith('<![CDATA[', childTagIndex)) {
        const cdataEnd = innerXml.indexOf(']]>', childTagIndex + 9)
        if (cdataEnd === -1) break
        cursor = cdataEnd + 3
        continue
      }
      if (innerXml.startsWith('<?', childTagIndex)) {
        const declarationEnd = innerXml.indexOf('?>', childTagIndex + 2)
        if (declarationEnd === -1) break
        cursor = declarationEnd + 2
        continue
      }

      const childTagEnd = findTagEnd(innerXml, childTagIndex + 1)
      if (childTagEnd === -1) break
      const childTagContent = innerXml.slice(childTagIndex + 1, childTagEnd).trim()
      if (!childTagContent) {
        cursor = childTagEnd + 1
        continue
      }

      if (childTagContent.startsWith('/')) {
        const closeTagName = childTagContent.slice(1).split(/\s+/)[0].trim()
        if (closeTagName === tagName) {
          depth -= 1
        }
      } else {
        const childSelfClosing = /\/\s*$/.test(childTagContent)
        const childTagName = childTagContent
          .replace(/\/\s*$/, '')
          .split(/\s+/)[0]
          .trim()
        if (childTagName === tagName && !childSelfClosing) {
          depth += 1
        }
      }

      cursor = childTagEnd + 1
    }

    if (depth === 0) {
      topLevelFragments.push(innerXml.slice(index, cursor))
      index = cursor
      continue
    }

    break
  }

  return topLevelFragments
}

/**
 * 解析幻灯片XML
 */
function parseSlideXML(xmlString: string): SlideData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  const slideElement = xmlDoc.documentElement;
  
  // 解析基本属性
  const id = getElementText(slideElement, 'Id') || 'unknown';
  const width = parseInt(getElementText(slideElement, 'Width') || '1280', 10);
  const height = parseInt(getElementText(slideElement, 'Height') || '720', 10);
  const transitionKey = (getElementText(slideElement, 'TransitionKey') || 'None').trim()
  const durationTicks = parseInt(getElementText(slideElement, 'Duration') || '0', 10)
  const transitionDurationMs = Number.isFinite(durationTicks) && durationTicks > 0
    ? Math.max(0, Math.round(durationTicks / 10000))
    : 0
  const {
    animationOrders,
    animations
  } = parseSlideAnimations(slideElement)
  
  // 解析背景色或背景图片
  const backgroundElement = getDirectChildElement(slideElement, 'Background');
  let backgroundColor = '#ffffff';
  let backgroundImage: string | undefined;
  
  if (backgroundElement) {
    // 先检查是否有直属 ColorBrush
    const colorBrush = getDirectChildText(backgroundElement, 'ColorBrush')
    if (colorBrush) {
      backgroundColor = parseColor(colorBrush)
    }
    
    // 检查是否有直属 ImageBrush
    const imageBrush = getDirectChildElement(backgroundElement, 'ImageBrush')
    if (imageBrush) {
      const source = getDirectChildText(imageBrush, 'Source')
      if (source) {
        backgroundImage = source.replace('id://', '')
      }
    }
  }
  
  // 解析元素
  let elements: SlideData['elements'] = [];
  let issues: SlideData['issues'] = [];
  const elementsNode = slideElement.querySelector('Elements');
  if (elementsNode) {
    const topLevelNodes = Array.from(elementsNode.children);
    const rawXmlByIndex = extractTopLevelElementRawXml(xmlString)
    const elementTypeCounts = topLevelNodes.reduce((acc, node) => {
      const tagName = node.tagName;
      acc[tagName] = (acc[tagName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`[Slide ${id}] 发现元素类型统计:`, elementTypeCounts);
    console.log(`[Slide ${id}] 所有元素标签:`, topLevelNodes.map(n => n.tagName).join(', '));

    const parseResult = parseSlideElements(elementsNode, { slideId: id, rawXmlByIndex });
    elements = parseResult.elements;
    issues = parseResult.issues;
    console.log(`[Slide ${id}] 顶层元素 ${topLevelNodes.length} 个，解析后可渲染元素 ${elements.length} 个`);
  } else {
    console.log(`[Slide ${id}] 没有找到 Elements 节点`);
  }

  return {
    id,
    width,
    height,
    rawXml: xmlString,
    backgroundColor,
    backgroundImage,
    transition: {
      key: transitionKey,
      durationMs: transitionDurationMs
    },
    animationOrders,
    animations,
    issues,
    elements
  };
}
