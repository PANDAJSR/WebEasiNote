import { getElementText } from './xml-utils';

export interface PictureElement {
  type: 'picture';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceId: string; // id://xxx 格式的资源ID
  pictureName: string;
  alpha: number;
  rotation: number;
  displayRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pictureSize?: {
    width: number;
    height: number;
  };
}

/**
 * 解析图片元素
 */
export function parsePictureElement(pictureNode: Element): PictureElement | null {
  try {
    const id = getElementText(pictureNode, 'Id') || 'unknown';
    console.log(`  [Picture] 开始解析 ID: ${id.substring(0, 16)}...`);
    
    const x = parseFloat(getElementText(pictureNode, 'X') || '0');
    const y = parseFloat(getElementText(pictureNode, 'Y') || '0');
    const width = parseFloat(getElementText(pictureNode, 'Width') || '100');
    const height = parseFloat(getElementText(pictureNode, 'Height') || '100');
    
    console.log(`  [Picture] 位置: (${x}, ${y}), 尺寸: ${width}x${height}`);

    // 解析 Source (格式: id://xxx)
    const sourceText = getElementText(pictureNode, 'Source') || '';
    const sourceId = sourceText.replace('id://', '');
    
    console.log(`  [Picture] 资源ID: ${sourceId.substring(0, 20)}...`);

    const pictureName = getElementText(pictureNode, 'PictureName') || '';
    const alpha = parseFloat(getElementText(pictureNode, 'Alpha') || '1');
    const rotation = parseFloat(getElementText(pictureNode, 'Rotation') || '0');
    const displayRegionText = getElementText(pictureNode, 'DisplayRegion > Rectangle')
    const pictureSizeText = getElementText(pictureNode, 'MetaData > PictureSize')

    const parsePair = (value: string | null): [number, number] | null => {
      if (!value) return null
      const parts = value.split(',').map(item => parseFloat(item.trim()))
      if (parts.length !== 2 || parts.some(item => !Number.isFinite(item))) {
        return null
      }
      return [parts[0], parts[1]]
    }

    // Rectangle 结构是 x,y,height,width
    const parseDisplayRegion = (value: string | null) => {
      if (!value) return undefined
      const parts = value.split(',').map(item => parseFloat(item.trim()))
      if (parts.length !== 4 || parts.some(item => !Number.isFinite(item))) {
        return undefined
      }
      return {
        x: parts[0],
        y: parts[1],
        width: parts[3],
        height: parts[2]
      }
    }

    const displayRegion = parseDisplayRegion(displayRegionText)
    const pictureSizePair = parsePair(pictureSizeText)
    const pictureSize = pictureSizePair
      ? { width: pictureSizePair[0], height: pictureSizePair[1] }
      : undefined
    
    if (pictureName) {
      console.log(`  [Picture] 图片名称: ${pictureName}`);
    }
    
    console.log(`  [Picture] ✓ 解析完成`);

    return {
      type: 'picture',
      id,
      x,
      y,
      width,
      height,
      sourceId,
      pictureName,
      alpha,
      rotation,
      displayRegion,
      pictureSize
    };
  } catch (error) {
    console.error(`  [Picture] ✗ 解析异常:`, error);
    return null;
  }
}

/**
 * 资源引用映射
 */
export interface ResourceMap {
  [id: string]: string; // id -> file path
}

/**
 * 解析 Reference.xml 构建资源映射
 */
export function parseReferenceXML(xmlString: string): ResourceMap {
  const map: ResourceMap = {};
  
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    const relationships = xmlDoc.querySelectorAll('Relationship');
    console.log(`[Reference] 发现 ${relationships.length} 个资源引用`);
    
    relationships.forEach((rel, index) => {
      const id = rel.querySelector('Id')?.textContent;
      const target = rel.querySelector('Target')?.textContent;
      if (id && target) {
        map[id] = target.replace(/\\/g, '/'); // 统一路径分隔符
        console.log(`[Reference] #${index}: ${id.substring(0, 16)}... -> ${target}`);
      }
    });
  } catch (error) {
    console.error(`[Reference] 解析失败:`, error);
  }
  
  return map;
}

// JSZip 类型声明
interface JSZip {
  file(path: string): { async(type: 'blob'): Promise<Blob> } | null;
}

/**
 * 从 ENBX 文件加载图片资源
 */
export async function loadPictureFromENBX(
  zip: JSZip,
  sourceId: string,
  resourceMap: ResourceMap
): Promise<string | null> {
  const filePath = resourceMap[sourceId];
  if (!filePath) {
    console.warn(`[PictureLoader] 未找到资源ID对应的文件路径: ${sourceId.substring(0, 20)}...`);
    return null;
  }

  const file = zip.file(filePath);
  if (!file) {
    console.warn(`[PictureLoader] ZIP中未找到文件: ${filePath}`);
    return null;
  }

  try {
    const blob = await file.async('blob');
    const url = URL.createObjectURL(blob);
    console.log(`[PictureLoader] ✓ 加载成功: ${filePath}`);
    return url;
  } catch (error) {
    console.error(`[PictureLoader] ✗ 加载失败: ${filePath}`, error);
    return null;
  }
}

/**
 * 从文件夹加载图片资源
 */
export async function loadPictureFromFolder(
  resourcesHandle: FileSystemDirectoryHandle,
  sourceId: string,
  resourceMap: ResourceMap
): Promise<string | null> {
  const filePath = resourceMap[sourceId];
  if (!filePath) {
    console.warn(`[PictureLoader] 未找到资源ID对应的文件路径: ${sourceId.substring(0, 20)}...`);
    return null;
  }

  const fileName = filePath.split('/').pop();
  if (!fileName) {
    console.warn(`[PictureLoader] 无法提取文件名: ${filePath}`);
    return null;
  }

  try {
    const fileHandle = await resourcesHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);
    console.log(`[PictureLoader] ✓ 加载成功: ${fileName}`);
    return url;
  } catch (error) {
    console.error(`[PictureLoader] ✗ 加载失败: ${fileName}`, error);
    return null;
  }
}
