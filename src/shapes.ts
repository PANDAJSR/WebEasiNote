import type { TextLine } from './types';
import { getElementText, getDirectChildElement, getDirectChildText, parseColor } from './xml-utils';
import { convertSeewoFontSizeToCssPx } from './font-utils'

interface NormalizedPathResult {
  path: string
  fillRule?: 'nonzero' | 'evenodd'
}

function normalizeSeewoPath(rawPath: string): NormalizedPathResult {
  if (!rawPath) return { path: '' }

  let normalizedPath = rawPath.trim()
  let fillRule: 'nonzero' | 'evenodd' | undefined

  // 兼容希沃导出的 F0/F1 前缀：F0=evenodd, F1=nonzero
  const fillRuleMatch = normalizedPath.match(/^F([01])\s*/i)
  if (fillRuleMatch) {
    fillRule = fillRuleMatch[1] === '0' ? 'evenodd' : 'nonzero'
    normalizedPath = normalizedPath.slice(fillRuleMatch[0].length).trim()
  }

  // 兜底：若开头不是 SVG 合法路径命令，尝试从首个 M/m 处恢复
  if (normalizedPath && !/^[MmLlHhVvCcSsQqTtAaZz]/.test(normalizedPath)) {
    const moveToIndex = normalizedPath.search(/[Mm]/)
    if (moveToIndex > 0) {
      normalizedPath = normalizedPath.slice(moveToIndex)
    }
  }

  return { path: normalizedPath, fillRule }
}

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

export interface ShapeElement {
  type: 'shape';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  backgroundColor: string;
  foregroundColor: string;
  path: string;
  fillRule?: 'nonzero' | 'evenodd';
  geometryType: string;
  inlineText?: TextLine[];
  borderWidth?: number;
  borderColor?: string;
  lineType?: string;
  shadow?: {
    offset: number;
    opacity: number;
    blurRadius: number;
    angle: number;
    color: string;
  };
  reflection?: {
    offsetY: number;
    opacity: number;
    gradientStart: number;
    gradientEnd: number;
  };
}

/**
 * 解析形状元素
 */
export function parseShapeElement(shapeNode: Element): ShapeElement | null {
  try {
    const id = getDirectChildText(shapeNode, 'Id') || getElementText(shapeNode, 'Id') || 'unknown';
    console.log(`  [Shape] 开始解析 ID: ${id.substring(0, 16)}...`);

    const x = parseFloat(getDirectChildText(shapeNode, 'X') || getElementText(shapeNode, 'X') || '0');
    const y = parseFloat(getDirectChildText(shapeNode, 'Y') || getElementText(shapeNode, 'Y') || '0');
    const width = parseFloat(getDirectChildText(shapeNode, 'Width') || getElementText(shapeNode, 'Width') || '100');
    const height = parseFloat(getDirectChildText(shapeNode, 'Height') || getElementText(shapeNode, 'Height') || '50');
    const rotation = parseFloat(getDirectChildText(shapeNode, 'Rotation') || getElementText(shapeNode, 'Rotation') || '0');

    console.log(`  [Shape] 位置: (${x}, ${y}), 尺寸: ${width}x${height}`);

    // 解析形状整体透明度
    const parsedOpacity = parseFloat(getDirectChildText(shapeNode, 'Opacity') || getElementText(shapeNode, 'Opacity') || '1')
    const opacity = Number.isFinite(parsedOpacity)
      ? Math.max(0, Math.min(1, parsedOpacity))
      : 1

    // 解析背景色
    let backgroundColor = '#ffffff';
    const backgroundNode = shapeNode.querySelector('Background');
    if (backgroundNode) {
      const colorBrush = backgroundNode.querySelector('ColorBrush');
      if (colorBrush?.textContent) {
        backgroundColor = parseColor(colorBrush.textContent, true);
        console.log(`  [Shape] 背景色: ${backgroundColor}`);
      }
    }

    // 解析前景色
    let foregroundColor = '#000000';
    const foregroundNode = shapeNode.querySelector('Foreground');
    if (foregroundNode) {
      const colorBrush = foregroundNode.querySelector('ColorBrush');
      if (colorBrush?.textContent) {
        foregroundColor = parseColor(colorBrush.textContent, true);
      }
    }

    // 解析路径
    const pathElement = getDirectChildElement(shapeNode, 'Path');
    const rawPath = pathElement?.textContent || getDirectChildText(shapeNode, 'Path') || getElementText(shapeNode, 'Path') || '';
    const normalizedPathResult = normalizeSeewoPath(rawPath)
    const path = normalizedPathResult.path
    console.log(`  [Shape] SVG Path: ${path.substring(0, 50)}${path.length > 50 ? '...' : ''}`);
    const normalizeFillRule = (value?: string | null): 'nonzero' | 'evenodd' | undefined => {
      if (!value) return undefined
      const raw = value.trim().toLowerCase()
      if (!raw) return undefined
      if (raw === 'evenodd' || raw === 'evenoddrule' || raw === 'alternate' || raw === 'odd') {
        return 'evenodd'
      }
      if (raw === 'nonzero' || raw === 'winding' || raw === 'default') {
        return 'nonzero'
      }
      return undefined
    }

    let fillRule: 'nonzero' | 'evenodd' | undefined
    fillRule = normalizeFillRule(pathElement?.getAttribute('FillRule') || pathElement?.getAttribute('fill-rule'))
      || normalizeFillRule(getDirectChildText(shapeNode, 'FillRule'))
      || normalizeFillRule(getDirectChildText(shapeNode, 'PathFillRule'))

    if (!fillRule) {
      const pathGeometryNode = shapeNode.querySelector('PathGeometry')
      fillRule = normalizeFillRule(pathGeometryNode?.getAttribute('FillRule') || pathGeometryNode?.getAttribute('fill-rule'))
        || normalizeFillRule(getElementText(pathGeometryNode || shapeNode, 'FillRule'))
    }
    if (!fillRule) {
      fillRule = normalizedPathResult.fillRule
    }

    // 解析几何类型
    let geometryType = 'Rectangle';
    const geometryNode = shapeNode.querySelector('Geometry');
    if (geometryNode) {
      const presetNode = geometryNode.querySelector('PresetGeometry');
      if (presetNode) {
        const typeNode = presetNode.querySelector('GeometryType');
        if (typeNode?.textContent) {
          geometryType = typeNode.textContent;
          console.log(`  [Shape] 几何类型: ${geometryType}`);
        }
      }
    }
    // 解析边框粗细和线条类型
    const thickness = parseFloat(getDirectChildText(shapeNode, 'Thickness') || getElementText(shapeNode, 'Thickness') || '0');
    const lineType = getDirectChildText(shapeNode, 'LineType') || getElementText(shapeNode, 'LineType') || 'None';
    if (thickness > 0) {
      console.log(`  [Shape] 边框粗细: ${thickness}, 线条类型: ${lineType}`);
    }

    // 解析内联文本（可选）
    let inlineText: TextLine[] | undefined;
    const inlineTextNode = shapeNode.querySelector('InlineText');
    if (inlineTextNode) {
      console.log(`  [Shape] 发现内联文本`);
      const richTextNode = inlineTextNode.querySelector('RichText');
      if (richTextNode) {
        const textLinesNode = richTextNode.querySelector('TextLines');
        if (textLinesNode) {
          inlineText = [];
          const textLineNodes = textLinesNode.querySelectorAll('TextLine');
          textLineNodes.forEach((lineNode, index) => {
            const textLine = parseTextLineForShape(lineNode);
            if (textLine) {
              inlineText!.push(textLine);
              console.log(`  [Shape]   内联文本行 #${index}: ${textLine.textRuns.length} 个 run`);
            }
          });
        }
      }
    }

    // 解析阴影效果（可选）
    let shadow: ShapeElement['shadow'] | undefined;
    // 解析倒影效果（可选）
    let reflection: ShapeElement['reflection'] | undefined;

    const effectsNode = shapeNode.querySelector('Effects');
    if (effectsNode) {
      // 解析阴影
      const dropShadowNode = effectsNode.querySelector('DropShadow');
      if (dropShadowNode) {
        const offset = parseFloat(getElementText(dropShadowNode, 'Offset') || '4');
        const opacity = parseFloat(getElementText(dropShadowNode, 'Opacity') || '0.5');
        const blurRadius = parseFloat(getElementText(dropShadowNode, 'BlurRadius') || '8');
        const angle = parseFloat(getElementText(dropShadowNode, 'Angle') || '135');

        let shadowColor = '#000000';
        const shadowBrushNode = dropShadowNode.querySelector('ShadowBrush');
        if (shadowBrushNode) {
          const colorBrush = shadowBrushNode.querySelector('ColorBrush');
          if (colorBrush?.textContent) {
            shadowColor = parseColor(colorBrush.textContent, true);
          }
        }

        shadow = {
          offset,
          opacity,
          blurRadius,
          angle,
          color: shadowColor
        };
        console.log(`  [Shape] 阴影效果: 偏移=${offset}, 透明度=${opacity}, 模糊=${blurRadius}, 角度=${angle}`);
      }

      // 解析倒影
      const reflectionNode = effectsNode.querySelector('Reflection');
      if (reflectionNode) {
        const offsetY = parseFloat(getElementText(reflectionNode, 'OffsetY') || '0');
        const opacity = parseFloat(getElementText(reflectionNode, 'Opacity') || '0.5');

        // 解析渐变遮罩
        let gradientStart = 0.5; // 默认值
        let gradientEnd = 1.0;

        const opacityMaskNode = reflectionNode.querySelector('OpacityMask');
        if (opacityMaskNode) {
          const linearGradientNode = opacityMaskNode.querySelector('LinearGradientBrush');
          if (linearGradientNode) {
            const gradientStopsNode = linearGradientNode.querySelector('GradientStops');
            if (gradientStopsNode?.textContent) {
              // 格式: "#00000000,0.8 #ff000000,1"
              const stopsText = gradientStopsNode.textContent.trim();
              const stops = stopsText.split(' ').map(s => s.trim()).filter(s => s);
              if (stops.length >= 2) {
                const firstStop = stops[0].split(',');
                const secondStop = stops[1].split(',');
                if (firstStop.length >= 2) {
                  gradientStart = parseFloat(firstStop[1]) || 0.5;
                }
                if (secondStop.length >= 2) {
                  gradientEnd = parseFloat(secondStop[1]) || 1.0;
                }
              }
            }
          }
        }

        reflection = {
          offsetY,
          opacity,
          gradientStart,
          gradientEnd
        };
        console.log(`  [Shape] 倒影效果: 偏移=${offsetY}, 透明度=${opacity}, 渐变=${gradientStart}-${gradientEnd}`);
      }
    }

    console.log(`  [Shape] ✓ 解析完成`);

    return {
      type: 'shape',
      id,
      x,
      y,
      width,
      height,
      rotation: Number.isFinite(rotation) ? rotation : 0,
      opacity,
      backgroundColor,
      foregroundColor,
      path,
      fillRule,
      geometryType,
      inlineText,
      borderWidth: thickness > 0 ? thickness : undefined,
      borderColor: thickness > 0 ? foregroundColor : undefined,
      lineType: lineType !== 'None' ? lineType : undefined,
      shadow,
      reflection
    };
  } catch (error) {
    console.error(`  [Shape] ✗ 解析异常:`, error);
    return null;
  }
}

/**
 * 解析形状中的文本行
 */
function parseTextLineForShape(lineNode: Element): TextLine | null {
  try {
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

    const textRuns: TextLine['textRuns'] = [];

    const textRunsNode = lineNode.querySelector('TextRuns');
    if (textRunsNode) {
      const textRunNodes = textRunsNode.querySelectorAll('TextRun');
      textRunNodes.forEach(runNode => {
        let text = getElementText(runNode, 'Text') || '';
        text = text.replace(/[\r\n]+$/g, '');
        const fontFamilyNode = runNode.querySelector('FontFamily');
        const fontFamily = getElementText(fontFamilyNode || runNode, 'Source') || 'Arial';
        const fontSizeRaw = parseFloat(getElementText(runNode, 'FontSize') || '16');
        const fontSize = convertSeewoFontSizeToCssPx(fontSizeRaw);
        const fontStyle = (getElementText(runNode, 'FontStyle') || 'Normal').toLowerCase() as 'normal' | 'italic';
        const fontWeight = (getElementText(runNode, 'FontWeight') || 'Normal').toLowerCase() === 'bold' ? 'bold' : 'normal';
        const opacity = parseFloat(getElementText(runNode, 'Opacity') || '1');
        const decoration = (getElementText(runNode, 'Decoration') || 'None') as 'None' | 'Underline';

        let color = '#000000';
        let gradient: TextLine['textRuns'][number]['gradient']
        const foregroundNode = runNode.querySelector('Foreground');
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

        textRuns.push({
          text,
          fontFamily,
          fontSize,
          fontStyle,
          fontWeight,
          color,
          gradient,
          opacity,
          decoration
        });
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
  } catch (error) {
    console.error(`    [ShapeText] 解析文本行失败:`, error);
    return null;
  }
}
