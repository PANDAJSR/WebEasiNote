// XML 工具函数模块

/**
 * 获取元素文本内容
 */
export function getElementText(parent: Element, tagName: string): string | null {
  const element = parent.querySelector(tagName);
  return element?.textContent || null;
}

/**
 * 获取直属子元素文本内容（不递归）
 */
export function getDirectChildText(parent: Element, tagName: string): string | null {
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tagName) {
      return child.textContent || null
    }
  }
  return null
}

/**
 * 获取直属子元素
 */
export function getDirectChildElement(parent: Element, tagName: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tagName) {
      return child
    }
  }
  return null
}

/**
 * 解析颜色值
 * @param colorValue - 颜色值字符串
 * @param preserveAlpha - 是否保留透明度（默认false，返回hex；true则返回rgba）
 */
export function parseColor(colorValue: string, preserveAlpha = false): string {
  const normalizedColorValue = colorValue.trim()
  // 处理 ARGB 格式: #AARRGGBB
  if (normalizedColorValue.match(/^#[0-9A-Fa-f]{8}$/)) {
    const a = parseInt(normalizedColorValue.substr(1, 2), 16) / 255;
    const r = parseInt(normalizedColorValue.substr(3, 2), 16);
    const g = parseInt(normalizedColorValue.substr(5, 2), 16);
    const b = parseInt(normalizedColorValue.substr(7, 2), 16);
    
    if (preserveAlpha && a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    }
    return `#${normalizedColorValue.substr(3, 2)}${normalizedColorValue.substr(5, 2)}${normalizedColorValue.substr(7, 2)}`;
  }
  // 处理 RGB 格式: #RRGGBB
  if (normalizedColorValue.match(/^#[0-9A-Fa-f]{6}$/)) {
    return normalizedColorValue;
  }
  return normalizedColorValue;
}

/**
 * 简单的XML解析器
 */
export function parseXML(xmlString: string): unknown {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('XML解析错误');
  }
  
  return xmlToJson(xmlDoc.documentElement);
}

/**
 * 将XML元素转换为JSON
 */
function xmlToJson(xmlNode: Node): unknown {
  // 文本节点
  if (xmlNode.nodeType === Node.TEXT_NODE || xmlNode.nodeType === Node.CDATA_SECTION_NODE) {
    const value = xmlNode.nodeValue?.trim();
    return value || null;
  }
  
  if (xmlNode.nodeType !== Node.ELEMENT_NODE) {
    return {};
  }
  
  const element = xmlNode as Element;
  const result: Record<string, unknown> = {};
  
  // 处理属性
  if (element.attributes && element.attributes.length > 0) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      result[`@${attr.nodeName}`] = attr.nodeValue;
    }
  }
  
  // 处理子节点
  let hasChildElements = false;
  let textContent = '';
  
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    
    if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
      textContent += child.nodeValue || '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      hasChildElements = true;
      const childName = (child as Element).nodeName;
      const childData = xmlToJson(child);
      
      if (childData !== null) {
        if (result[childName] === undefined) {
          result[childName] = childData;
        } else {
          // 多个同名子节点，转为数组
          if (!Array.isArray(result[childName])) {
            result[childName] = [result[childName]];
          }
          (result[childName] as unknown[]).push(childData);
        }
      }
    }
  }
  
  // 如果没有子元素，返回文本内容
  if (!hasChildElements) {
    textContent = textContent.trim();
    return textContent || null;
  }
  
  // 如果有文本内容，添加到结果
  textContent = textContent.trim();
  if (textContent) {
    result['#text'] = textContent;
  }
  
  return result;
}

/**
 * 格式化日期时间
 */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '未知';
  
  try {
    // 尝试解析格式: 03/05/2026 20:44:13
    const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const [, month, day, year, hour, minute] = match;
      return `${year}年${month}月${day}日 ${hour}:${minute}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}
