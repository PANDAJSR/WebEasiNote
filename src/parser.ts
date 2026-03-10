import JSZip from 'jszip';
import type {
  CoursewareMetadata,
  DocumentData,
  SlideData
} from './types';
import { parseXML, getElementText, parseColor } from './xml-utils';
import { parseSlideElements } from './slide-elements-parser';

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
  
  // 解析背景色或背景图片
  const backgroundElement = slideElement.querySelector('Background');
  let backgroundColor = '#ffffff';
  let backgroundImage: string | undefined;
  
  if (backgroundElement) {
    // 先检查是否有 ColorBrush
    const colorBrush = backgroundElement.querySelector('ColorBrush');
    if (colorBrush?.textContent) {
      backgroundColor = parseColor(colorBrush.textContent);
    }
    
    // 检查是否有 ImageBrush
    const imageBrush = backgroundElement.querySelector('ImageBrush');
    if (imageBrush) {
      const source = imageBrush.querySelector('Source')?.textContent;
      if (source) {
        backgroundImage = source.replace('id://', '');
      }
    }
  }
  
  // 解析元素
  let elements: SlideData['elements'] = [];
  let issues: SlideData['issues'] = [];
  const elementsNode = slideElement.querySelector('Elements');
  if (elementsNode) {
    const topLevelNodes = Array.from(elementsNode.children);
    const elementTypeCounts = topLevelNodes.reduce((acc, node) => {
      const tagName = node.tagName;
      acc[tagName] = (acc[tagName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`[Slide ${id}] 发现元素类型统计:`, elementTypeCounts);
    console.log(`[Slide ${id}] 所有元素标签:`, topLevelNodes.map(n => n.tagName).join(', '));

    const parseResult = parseSlideElements(elementsNode, { slideId: id });
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
    backgroundColor,
    backgroundImage,
    issues,
    elements
  };
}
