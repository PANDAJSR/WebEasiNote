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

export function extractTopLevelElementRawXml(slideXml: string): string[] {
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
