// 文本元素解析模块
import type { TextElement, TextLine, TextRun } from './types';
import { getElementText, parseColor } from './xml-utils';
import { convertSeewoFontSizeToCssPx } from './font-utils'

function parsePoint(value: string | null): { x: number; y: number } | null {
  if (!value) return null
  const parts = value.split(',').map(item => parseFloat(item.trim()))
  if (parts.length !== 2 || parts.some(item => !Number.isFinite(item))) return null
  return { x: parts[0], y: parts[1] }
}

function parseGradientStops(value: string | null): Array<{ color: string; offset: number }> {
  if (!value) return []
  return value
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const parts = item.split(',')
      if (parts.length !== 2) return null
      const color = parseColor(parts[0].trim(), true)
      const offset = parseFloat(parts[1].trim())
      if (!Number.isFinite(offset)) return null
      return { color, offset: Math.min(1, Math.max(0, offset)) }
    })
    .filter((item): item is { color: string; offset: number } => !!item)
    .sort((a, b) => a.offset - b.offset)
}

/**
 * 解析文本元素
 */
export function parseTextElement(textNode: Element): TextElement | null {
  try {
    const id = getElementText(textNode, 'Id') || 'unknown';
    console.log(`  [Text] 开始解析 ID: ${id.substring(0, 16)}...`);
    
    const x = parseFloat(getElementText(textNode, 'X') || '0');
    const y = parseFloat(getElementText(textNode, 'Y') || '0');
    const width = parseFloat(getElementText(textNode, 'Width') || '100');
    const height = parseFloat(getElementText(textNode, 'Height') || '50');
    const rotation = parseFloat(getElementText(textNode, 'Rotation') || '0');
    const borderThickness = parseFloat(getElementText(textNode, 'BorderThickness') || '0');
    const borderType = getElementText(textNode, 'BorderType') || 'None';
    
    console.log(`  [Text] 位置: (${x}, ${y}), 尺寸: ${width}x${height}`);

    // 解析 RichText
    const richTextNode = textNode.querySelector('RichText');
    if (!richTextNode) {
      console.warn(`  [Text] ✗ 未找到 RichText 节点`);
      return null;
    }
    
    console.log(`  [Text] 找到 RichText 节点`);
    const arrangingType = (getElementText(richTextNode, 'ArrangingType') || 'Horizontal') as 'Horizontal' | 'Vertical';
    const sizeToContent = (getElementText(richTextNode, 'SizeToContent') || 'Manual') as 'Manual' | 'Height' | 'WidthAndHeight';
    const verticalTextAlignment = (getElementText(richTextNode, 'VerticalTextAlignment') || 'Top') as 'Top' | 'Center' | 'Bottom';

    const textLines: TextLine[] = []

    // 获取 TextLines
    const textLinesNode = richTextNode.querySelector('TextLines');
    if (textLinesNode) {
      const textLineNodes = textLinesNode.querySelectorAll('TextLine');
      console.log(`  [Text] 找到 ${textLineNodes.length} 个 TextLine`);
      
      textLineNodes.forEach((lineNode, index) => {
        const textLine = parseTextLine(lineNode);
        if (textLine) {
          textLines.push(textLine);
          console.log(`  [Text]   TextLine #${index}: ${textLine.textRuns.length} 个 textRun`);
        } else {
          console.warn(`  [Text]   TextLine #${index} 解析失败`);
        }
      })
    } else {
      console.warn(`  [Text] 未找到 TextLines 节点`);
    }

    // 仅当整段文本没有任何可用 TextRun 时，才回退到 RichText.Text
    // 避免空行 TextLine 触发整段文本重复渲染
    const hasAnyTextRun = textLines.some(line => line.textRuns.length > 0)
    if (!hasAnyTextRun) {
      const text = getElementText(richTextNode, 'Text')
      if (text) {
        textLines.push({
          textRuns: [
            {
              text,
              fontFamily: 'Arial',
              fontSize: convertSeewoFontSizeToCssPx(16),
              fontStyle: 'normal',
              fontWeight: 'normal',
              color: '#000000',
              opacity: 1,
              decoration: 'None'
            }
          ],
          textAlignment: 'Left',
          textMarker: 'None',
          indent: 0,
          indentLevel: 0,
          indentType: 'FirstLine',
          marginLeft: 0,
          direction: 'LeftToRight',
          lineSpacing: 1,
          spaceBefore: 0,
          spaceAfter: 0
        })
      }
    }
    
    console.log(`  [Text] ✓ 解析完成, 共 ${textLines.length} 行文本`);

    return {
      type: 'text',
      id,
      x,
      y,
      width,
      height,
      rotation,
      borderThickness,
      borderType,
      arrangingType,
      sizeToContent,
      verticalTextAlignment,
      textLines
    };
  } catch (error) {
    console.error(`  [Text] ✗ 解析异常:`, error);
    return null;
  }
}

/**
 * 解析文本行
 */
function parseTextLine(lineNode: Element): TextLine | null {
  try {
    // 获取对齐方式
    const textAlignment = (getElementText(lineNode, 'TextAlignment') || 'Left') as 'Left' | 'Center' | 'Right';
    const textMarker = getElementText(lineNode, 'TextMarker') || 'None';
    const indent = parseFloat(getElementText(lineNode, 'Indent') || '0');
    const indentLevel = parseInt(getElementText(lineNode, 'IndentLevel') || '0', 10);
    const indentType = getElementText(lineNode, 'IndentType') || 'FirstLine';
    const marginLeft = parseFloat(getElementText(lineNode, 'MarginLeft') || '0');
    const direction = (getElementText(lineNode, 'Direction') || 'LeftToRight') as 'LeftToRight' | 'RightToLeft';
    const lineSpacing = parseFloat(getElementText(lineNode, 'LineSpacing') || '1');
    const fixedLineSpacing = parseFloat(getElementText(lineNode, 'FixedLineSpacing') || 'NaN');
    const spaceBefore = parseFloat(getElementText(lineNode, 'SpaceBefore') || '0');
    const spaceAfter = parseFloat(getElementText(lineNode, 'SpaceAfter') || '0');

    const textMarkerStyleNode = lineNode.querySelector('TextMarkerStyle');
    const textMarkerStyle = textMarkerStyleNode
      ? {
          char: getElementText(textMarkerStyleNode, 'Char') || undefined,
          fontFamily: getElementText(textMarkerStyleNode, 'Source') || undefined,
          autoNumberType: getElementText(textMarkerStyleNode, 'AutoNumberType') || undefined,
          startAt: parseInt(getElementText(textMarkerStyleNode, 'StartAt') || '1', 10),
        }
      : undefined;

    const textRuns: TextRun[] = [];

    // 获取 TextRuns
    const textRunsNode = lineNode.querySelector('TextRuns');
    if (textRunsNode) {
      const textRunNodes = textRunsNode.querySelectorAll('TextRun');
      textRunNodes.forEach(runNode => {
        const textRun = parseTextRun(runNode);
        if (textRun) {
          // 多行文本场景中，导出的 TextRun 可能包含行尾换行符，这里清理掉以避免重复换行
          // 仅当存在非换行字符时才去掉末尾换行；纯换行内容用于表示空行，需要保留
          if (textRun.text) {
            const hasNonBreakChar = /[^\r\n]/.test(textRun.text)
            textRun.text = hasNonBreakChar
              ? textRun.text.replace(/[\r\n]+$/g, '')
              : '\n'
          }
          textRuns.push(textRun);
        }
      });
    }

    return {
      textRuns,
      textAlignment,
      textMarker,
      textMarkerStyle,
      indent,
      indentLevel,
      indentType,
      marginLeft,
      direction,
      lineSpacing,
      fixedLineSpacing: Number.isFinite(fixedLineSpacing) ? fixedLineSpacing : undefined,
      spaceBefore,
      spaceAfter
    };
  } catch {
    return null;
  }
}

/**
 * 解析文本样式
 */
function parseTextRun(runNode: Element): TextRun | null {
  try {
    const text = getElementText(runNode, 'Text') || '';
    
    // 获取字体
    const fontFamilyNode = runNode.querySelector('FontFamily');
    const fontFamily = getElementText(fontFamilyNode || runNode, 'Source') || 'Arial';
    
    // 获取字体大小 (希沃FontSize为pt，需换算成CSS像素)
    const fontSizeRaw = parseFloat(getElementText(runNode, 'FontSize') || '16');
    const fontSize = convertSeewoFontSizeToCssPx(fontSizeRaw);

    // 获取字体样式
    const fontStyle = (getElementText(runNode, 'FontStyle') || 'Normal').toLowerCase() as 'normal' | 'italic';
    
    // 获取字体粗细
    const fontWeight = (getElementText(runNode, 'FontWeight') || 'Normal').toLowerCase() === 'bold' ? 'bold' : 'normal';
    
    // 获取颜色
    const foregroundNode = runNode.querySelector('Foreground');
    let color = '#000000';
    let gradient: TextRun['gradient'];
    if (foregroundNode) {
      const colorBrush = foregroundNode.querySelector('ColorBrush');
      if (colorBrush?.textContent) {
        color = parseColor(colorBrush.textContent, true);
      }

      const linearGradientBrush = foregroundNode.querySelector('LinearGradientBrush')
      if (linearGradientBrush) {
        const startPoint = parsePoint(getElementText(linearGradientBrush, 'StartPoint')) || { x: 0, y: 0 }
        const endPoint = parsePoint(getElementText(linearGradientBrush, 'EndPoint')) || { x: 0, y: 1 }
        const stops = parseGradientStops(getElementText(linearGradientBrush, 'GradientStops'))
        if (stops.length > 0) {
          gradient = {
            startPoint,
            endPoint,
            stops,
            opacity: parseFloat(getElementText(linearGradientBrush, 'Opacity') || '1')
          }
          color = stops[stops.length - 1]?.color || color
        }
      }
    }
    const opacity = parseFloat(getElementText(runNode, 'Opacity') || '1');
    const decoration = (getElementText(runNode, 'Decoration') || 'None') as 'None' | 'Underline';
    const textEffectsNode = runNode.querySelector('TextEffects');
    let textEffects: TextRun['textEffects'];

    if (textEffectsNode) {
      const frameNode = textEffectsNode.querySelector('TextFrame');
      const shadowNode = textEffectsNode.querySelector('TextShadow');
      const reflectionNode = textEffectsNode.querySelector('TextReflection');

      if (frameNode) {
        const thickness = parseFloat(
          getElementText(frameNode, 'FrameThinkness') ||
          getElementText(frameNode, 'FrameThickness') ||
          '0'
        )
        const frameOpacity = parseFloat(getElementText(frameNode, 'FrameOpacity') || '1')

        let frameColor = '#000000'
        const brushNode = frameNode.querySelector('FrameBrush')
        const colorBrush = brushNode?.querySelector('ColorBrush')
        if (colorBrush?.textContent) {
          frameColor = parseColor(colorBrush.textContent, true)
        }

        textEffects = {
          ...textEffects,
          frame: {
            thickness,
            opacity: frameOpacity,
            color: frameColor
          }
        }
      }

      if (shadowNode) {
        const blur = parseFloat(getElementText(shadowNode, 'Blur') || '0');
        const direction = parseFloat(getElementText(shadowNode, 'Direction') || '0');
        const distance = parseFloat(getElementText(shadowNode, 'Distance') || '0');
        const shadowOpacity = parseFloat(getElementText(shadowNode, 'Opacity') || '1');

        let shadowColor = '#000000';
        const brushNode = shadowNode.querySelector('Brush');
        const colorBrush = brushNode?.querySelector('ColorBrush');
        if (colorBrush?.textContent) {
          shadowColor = parseColor(colorBrush.textContent, true);
        }

        textEffects = {
          ...textEffects,
          shadow: {
            blur,
            direction,
            distance,
            opacity: shadowOpacity,
            color: shadowColor
          }
        };
      }

      if (reflectionNode) {
        const depth = parseFloat(getElementText(reflectionNode, 'Depth') || '0.2');
        const distance = parseFloat(getElementText(reflectionNode, 'Distance') || '0');
        const reflectionOpacity = parseFloat(getElementText(reflectionNode, 'Opacity') || '0.4');

        textEffects = {
          ...textEffects,
          reflection: {
            depth,
            distance,
            opacity: reflectionOpacity
          }
        };
      }
    }

    return {
      text,
      fontFamily,
      fontSize,
      fontStyle,
      fontWeight,
      color,
      gradient,
      opacity,
      decoration,
      textEffects
    };
  } catch {
    return null;
  }
}
