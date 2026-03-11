import type { CSSProperties } from 'react';
import type { SlideData, TextElement, SlideElement, UnknownElement, TopicElement, CylinderElement, ConeElement, CubeElement, GeometryElement } from '../parser';
import type { ShapeElement } from '../shapes';
import type { PictureElement } from '../pictures';
import type { VideoElement } from '../videos'
import type { TableElement } from '../types'
import { ShapeRenderer } from './ShapeRenderer';
import { PictureRenderer } from './PictureRenderer';
import { VideoRenderer } from './VideoRenderer'
import { TableRenderer } from './TableRenderer'
import { TopicRenderer } from './TopicRenderer'
import { CylinderRenderer } from './CylinderRenderer'
import { ConeRenderer } from './ConeRenderer'
import { CubeRenderer } from './CubeRenderer'
import { GeometryRenderer } from './GeometryRenderer'
import { buildFontFamily } from '../font-utils';
import { convertSeewoLineSpacingToMultiplier } from '../line-spacing';

interface SlideRendererProps {
  slide: SlideData;
  scale?: number;
  resourceMap?: Record<string, string>; // sourceId -> blob URL
  slideIndex?: number;
  currentIndex?: number;
}

function buildTextGradient(run: TextElement['textLines'][number]['textRuns'][number]): string | undefined {
  const gradient = run.gradient
  if (!gradient || gradient.stops.length === 0) return undefined

  const dx = gradient.endPoint.x - gradient.startPoint.x
  const dy = gradient.endPoint.y - gradient.startPoint.y
  const angle = Number.isFinite(dx) && Number.isFinite(dy) && (dx !== 0 || dy !== 0)
    ? (Math.atan2(dy, dx) * 180) / Math.PI + 90
    : 180
  const stops = gradient.stops
    .map(stop => `${stop.color} ${(stop.offset * 100).toFixed(2)}%`)
    .join(', ')

  return `linear-gradient(${angle.toFixed(2)}deg, ${stops})`
}

/**
 * 幻灯片渲染器 - 使用 DOM 实现矢量渲染
 */
export function SlideRenderer({
  slide,
  scale = 1,
  resourceMap = {},
  slideIndex = 0,
  currentIndex = 0
}: SlideRendererProps) {
  // 获取背景图片 URL
  const backgroundImageUrl = slide.backgroundImage ? resourceMap[slide.backgroundImage] : null;
  const scaledWidth = slide.width * scale
  const scaledHeight = slide.height * scale

  return (
    <div
      style={{
        position: 'relative',
        width: scaledWidth,
        height: scaledHeight,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        borderRadius: '4px',
        transformOrigin: 'top left',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: slide.width,
          height: slide.height,
          backgroundColor: slide.backgroundColor,
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        {slide.elements.map((element) => (
          <ElementRenderer
            key={element.id}
            element={element}
            scale={1}
            resourceMap={resourceMap}
            slideIndex={slideIndex}
            currentIndex={currentIndex}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 元素渲染器 - 根据类型分发到不同的渲染器
 */
function ElementRenderer({ 
  element, 
  scale, 
  resourceMap,
  slideIndex,
  currentIndex
}: { 
  element: SlideElement; 
  scale: number; 
  resourceMap: Record<string, string>;
  slideIndex: number;
  currentIndex: number;
}) {
  switch (element.type) {
    case 'text':
      return <TextElementRenderer element={element} scale={scale} />;
    case 'shape':
      return <ShapeRenderer element={element as ShapeElement} scale={scale} />;
    case 'picture':
      return <PictureRenderer element={element as PictureElement} scale={scale} resourceMap={resourceMap} />;
    case 'video':
      return (
        <VideoRenderer
          element={element as VideoElement}
          scale={scale}
          resourceMap={resourceMap}
          isCurrentSlide={slideIndex === currentIndex}
          currentSlideNumber={currentIndex + 1}
          sourceSlideNumber={slideIndex + 1}
        />
      )
    case 'table':
      return <TableRenderer element={element as TableElement} scale={scale} />
    case 'topic':
      return <TopicRenderer element={element as TopicElement} scale={scale} />
    case 'cylinder':
      return <CylinderRenderer element={element as CylinderElement} scale={scale} />
    case 'cone':
      return <ConeRenderer element={element as ConeElement} scale={scale} />
    case 'cube':
      return <CubeRenderer element={element as CubeElement} scale={scale} />
    case 'geometry':
      return <GeometryRenderer element={element as GeometryElement} scale={scale} />
    case 'unknown':
      return <UnknownElementPlaceholder element={element as UnknownElement} scale={scale} />;
    default:
      // 未识别的元素类型，显示占位符
      return <UnknownElementPlaceholder element={element} scale={scale} />;
  }
}

/**
 * 未识别元素的占位符
 */
function UnknownElementPlaceholder({ element, scale }: { element: SlideElement; scale: number }) {
  // 尝试获取元素的位置和尺寸信息
  const x = (element as { x?: number }).x ?? 0;
  const y = (element as { y?: number }).y ?? 0;
  const width = (element as { width?: number }).width ?? 100;
  const height = (element as { height?: number }).height ?? 50;
  const id = (element as { id?: string }).id ?? 'unknown';
  
  // 获取元素类型名称 - 优先显示原始类型
  const rawType = (element as { type?: string }).type ?? 'unknown';
  const originalType = (element as { originalType?: string }).originalType;
  const typeName = originalType || rawType;

  return (
    <div
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        backgroundColor: '#fef3c7',
        border: '1px dashed #f59e0b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10 * scale,
        color: '#92400e',
        textAlign: 'center',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontWeight: 'bold', marginBottom: 2 * scale }}>⚠️ 无法显示</span>
      <span>类型: {typeName}</span>
      <span style={{ fontSize: 8 * scale, opacity: 0.7, marginTop: 2 * scale }}>
        ID: {id.slice(0, 8)}...
      </span>
    </div>
  );
}

/**
 * 文本元素渲染器
 */
function TextElementRenderer({ element, scale }: { element: TextElement; scale: number }) {
  const { x, y, width, height, textLines } = element;
  const markerCounters: Record<string, number> = {};
  const textOuterPadding = 10 * scale

  const toLatin = (value: number, lower = false): string => {
    let n = value;
    let result = '';
    while (n > 0) {
      n -= 1;
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26);
    }
    return lower ? result.toLowerCase() : result;
  };

  const toCircleNumber = (value: number): string => {
    const circleNumbers = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
    return circleNumbers[value] || `${value}`;
  };

  const getMarkerText = (lineIndex: number): string | null => {
    const line = textLines[lineIndex];
    if (!line?.textMarker || line.textMarker === 'None') return null;

    const style = line.textMarkerStyle;
    if (style?.char) {
      return style.char;
    }

    const counterKey = `${line.textMarker}-${style?.autoNumberType || ''}-${style?.startAt || 1}`;
    if (!(counterKey in markerCounters)) {
      markerCounters[counterKey] = (style?.startAt || 1) - 1;
    }
    markerCounters[counterKey] += 1;
    const n = markerCounters[counterKey];

    switch (line.textMarker) {
      case 'Circle':
        return '●';
      case 'Rect':
      case 'Box':
      case 'Square':
        return '■';
      case 'Tick':
        return '✓';
      case 'Decimal':
        return `${n}.`;
      case 'Decimal1':
        return `(${n})`;
      case 'Decimal2':
        return toCircleNumber(n);
      case 'UpperLatin':
        return `${toLatin(n)}.`;
      case 'LowerLatin':
        return `${toLatin(n, true)}.`;
      default:
        return '•';
    }
  };

  const getLineHeight = (line: TextElement['textLines'][number]): string => {
    if (line.fixedLineSpacing && line.fixedLineSpacing > 0) {
      return `${line.fixedLineSpacing * scale}px`;
    }
    const multiplier = convertSeewoLineSpacingToMultiplier(line.lineSpacing);
    if (multiplier) {
      return `${multiplier}`;
    }
    return 'normal';
  };

  const getShadowStyle = (run: TextElement['textLines'][number]['textRuns'][number]): string | undefined => {
    const shadow = run.textEffects?.shadow;
    if (!shadow) return undefined;

    const radians = (shadow.direction * Math.PI) / 180;
    const offsetX = Math.cos(radians) * shadow.distance * scale;
    const offsetY = -Math.sin(radians) * shadow.distance * scale;
    let shadowColor = shadow.color;
    if (shadow.color.startsWith('rgba(')) {
      shadowColor = shadow.color.replace(/,\s*([0-9.]+)\)$/, (_, alpha) => `, ${(parseFloat(alpha) * shadow.opacity).toFixed(2)})`);
    } else if (shadow.color.startsWith('rgb(')) {
      shadowColor = shadow.color.replace('rgb(', 'rgba(').replace(')', `, ${shadow.opacity.toFixed(2)})`);
    } else if (shadow.color.startsWith('#') && shadow.color.length === 7) {
      const r = parseInt(shadow.color.slice(1, 3), 16);
      const g = parseInt(shadow.color.slice(3, 5), 16);
      const b = parseInt(shadow.color.slice(5, 7), 16);
      shadowColor = `rgba(${r}, ${g}, ${b}, ${shadow.opacity.toFixed(2)})`;
    }

    return `${offsetX.toFixed(2)}px ${offsetY.toFixed(2)}px ${(shadow.blur * scale).toFixed(2)}px ${shadowColor}`;
  };

  const mergeOpacityToColor = (color: string, opacity: number): string => {
    const normalizedOpacity = Math.min(1, Math.max(0, opacity))
    if (color.startsWith('rgba(')) {
      return color.replace(
        /,\s*([0-9.]+)\)$/,
        (_, alpha) => `, ${(parseFloat(alpha) * normalizedOpacity).toFixed(2)})`
      )
    }
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${normalizedOpacity.toFixed(2)})`)
    }
    if (color.startsWith('#') && color.length === 7) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity.toFixed(2)})`
    }
    return color
  }

  const getTextStrokeStyle = (
    run: TextElement['textLines'][number]['textRuns'][number]
  ): Pick<CSSProperties, 'WebkitTextStrokeColor' | 'WebkitTextStrokeWidth'> => {
    const frame = run.textEffects?.frame
    if (!frame || frame.thickness <= 0) {
      return {
        WebkitTextStrokeColor: undefined,
        WebkitTextStrokeWidth: undefined
      }
    }

    return {
      WebkitTextStrokeColor: mergeOpacityToColor(frame.color, frame.opacity),
      WebkitTextStrokeWidth: `${(frame.thickness * scale).toFixed(2)}px`
    }
  }

  const justifyContent = (() => {
    switch (element.verticalTextAlignment) {
      case 'Center':
        return 'center';
      case 'Bottom':
        return 'flex-end';
      default:
        return 'flex-start';
    }
  })();

  const reflectionEffect = (() => {
    for (const line of textLines) {
      for (const run of line.textRuns) {
        if (run.textEffects?.reflection) {
          return run.textEffects.reflection;
        }
      }
    }
    return undefined;
  })();

  const hasReflection = !!reflectionEffect;
  const reflectionOffset = hasReflection ? reflectionEffect.distance * scale : 0;
  const reflectionOpacity = hasReflection ? reflectionEffect.opacity : 0;
  const reflectionDepth = hasReflection ? Math.min(1, Math.max(reflectionEffect.depth, 0.1)) : 0;
  const mainHeight = height * scale;
  const estimateLineContentHeight = (line: TextElement['textLines'][number]): number => {
    const maxRunFontSize = Math.max(...line.textRuns.map(run => run.fontSize * scale), 16 * scale);
    if (line.fixedLineSpacing && line.fixedLineSpacing > 0) {
      return line.fixedLineSpacing * scale;
    }
    const multiplier = convertSeewoLineSpacingToMultiplier(line.lineSpacing);
    if (multiplier) {
      return maxRunFontSize * multiplier;
    }
    return maxRunFontSize * 1.2;
  };

  const contentHeight = Math.max(
    textLines.reduce((sum, line) => sum + estimateLineContentHeight(line) + (line.spaceBefore || 0) * scale + (line.spaceAfter || 0) * scale, 0),
    1
  );
  const availableHeight = Math.max(mainHeight - textOuterPadding * 2, 0);
  const contentTopOffset = (() => {
    if (element.sizeToContent !== 'Manual' || availableHeight <= contentHeight) return textOuterPadding;
    switch (element.verticalTextAlignment) {
      case 'Center':
        return textOuterPadding + (availableHeight - contentHeight) / 2;
      case 'Bottom':
        return textOuterPadding + (availableHeight - contentHeight);
      default:
        return textOuterPadding;
    }
  })();
  const textBottom = contentTopOffset + contentHeight;
  const reflectionVisibleHeight = contentHeight;
  const reflectionFadeStop = hasReflection
    ? Math.min(95, Math.max(20, (1 - reflectionDepth) * 100))
    : 0;

  const textContainerStyle: CSSProperties = {
    width: width * scale,
    minHeight: mainHeight,
    height: element.sizeToContent === 'Manual' ? mainHeight : 'auto',
    boxSizing: 'border-box',
    padding: textOuterPadding,
    paddingRight: 9.5 * scale,
    overflow: 'visible',
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    justifyContent,
    border: element.borderType && element.borderType !== 'None' && (element.borderThickness || 0) > 0
      ? `${(element.borderThickness || 0) * scale}px solid #000000`
      : undefined,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: 'center center',
    writingMode: element.arrangingType === 'Vertical' ? 'vertical-rl' : 'horizontal-tb'
  };

  const renderTextContent = () => (
    <>
      {textLines.map((line, lineIndex) => {
        const alignment = line.textAlignment.toLowerCase() as 'left' | 'center' | 'right'
        const basePaddingLeft = (line.marginLeft || 0) * scale
        const alignmentPaddingLeft = 0
        const alignmentPaddingRight = 0
        const hasRenderableText = line.textRuns.some(run => run.text.replace(/[\r\n]/g, '').length > 0)

        return (
          <div
            key={lineIndex}
            style={{
              width: '100%',
              position: 'relative',
              paddingLeft: basePaddingLeft + alignmentPaddingLeft,
              paddingRight: alignmentPaddingRight,
              textAlign: alignment,
              lineHeight: getLineHeight(line),
              marginTop: (line.spaceBefore || 0) * scale,
              marginBottom: (line.spaceAfter || 0) * scale,
              direction: line.direction === 'RightToLeft' ? 'rtl' : 'ltr',
              textIndent: line.indentType === 'FirstLine' && (line.indent || 0) !== 0
                ? `${(line.indent || 0) * scale}px`
                : undefined
            }}
          >
            {(() => {
              const markerText = getMarkerText(lineIndex);
              if (!markerText) return null;
              return (
                <span
                  style={{
                    position: 'absolute',
                    left: alignmentPaddingLeft,
                    top: 0,
                    minWidth: (line.indent || line.marginLeft || 0) * scale,
                    fontFamily: buildFontFamily(line.textMarkerStyle?.fontFamily),
                    fontSize: (line.textRuns[0]?.fontSize || 16) * scale,
                    fontSynthesis: 'style weight',
                    lineHeight: 'inherit',
                    whiteSpace: 'pre'
                  }}
                >
                  {markerText}
                </span>
              );
            })()}
            {hasRenderableText
              ? line.textRuns.map((run, runIndex) => (
                (() => {
                  const gradient = buildTextGradient(run)
                  const opacity = (run.opacity ?? 1) * (run.gradient?.opacity ?? 1)
                  const textStrokeStyle = getTextStrokeStyle(run)
                  return (
                    <span
                      key={runIndex}
                      style={{
                        fontFamily: buildFontFamily(run.fontFamily),
                        fontSize: run.fontSize * scale,
                        fontStyle: run.fontStyle,
                        fontWeight: run.fontWeight,
                        fontSynthesis: 'style weight',
                        color: gradient ? 'transparent' : run.color,
                        backgroundImage: gradient,
                        backgroundClip: gradient ? 'text' : undefined,
                        WebkitBackgroundClip: gradient ? 'text' : undefined,
                        WebkitTextFillColor: gradient ? 'transparent' : undefined,
                        opacity,
                        textDecoration: run.decoration === 'Underline' ? 'underline' : 'none',
                        textShadow: getShadowStyle(run),
                        WebkitTextStrokeWidth: textStrokeStyle.WebkitTextStrokeWidth,
                        WebkitTextStrokeColor: textStrokeStyle.WebkitTextStrokeColor,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {run.text}
                    </span>
                  )
                })()
              ))
              : (
                (() => {
                  const fallbackRun = line.textRuns[0]
                  const textStrokeStyle = fallbackRun ? getTextStrokeStyle(fallbackRun) : {}
                  return (
                    <span
                      style={{
                        fontFamily: buildFontFamily(line.textRuns[0]?.fontFamily),
                        fontSize: (line.textRuns[0]?.fontSize || 16) * scale,
                        fontStyle: line.textRuns[0]?.fontStyle || 'normal',
                        fontWeight: line.textRuns[0]?.fontWeight || 'normal',
                        fontSynthesis: 'style weight',
                        color: line.textRuns[0]?.color || '#000000',
                        opacity: line.textRuns[0]?.opacity ?? 1,
                        textDecoration: line.textRuns[0]?.decoration === 'Underline' ? 'underline' : 'none',
                        textShadow: line.textRuns[0] ? getShadowStyle(line.textRuns[0]) : undefined,
                        WebkitTextStrokeWidth: textStrokeStyle.WebkitTextStrokeWidth,
                        WebkitTextStrokeColor: textStrokeStyle.WebkitTextStrokeColor,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {'\u00A0'}
                    </span>
                  )
                })()
              )}
          </div>
        )
      })}
    </>
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: mainHeight + (hasReflection ? reflectionVisibleHeight + reflectionOffset : 0),
        overflow: 'visible',
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          ...textContainerStyle
        }}
      >
        {renderTextContent()}
      </div>

      {hasReflection && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: textBottom + reflectionVisibleHeight + reflectionOffset,
            width: width * scale,
            height: reflectionVisibleHeight,
            transform: 'scaleY(-1)',
            transformOrigin: 'center top',
            opacity: reflectionOpacity,
            WebkitMaskImage: `linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) ${reflectionFadeStop.toFixed(0)}%)`,
            maskImage: `linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) ${reflectionFadeStop.toFixed(0)}%)`,
            overflow: 'hidden',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              marginTop: -contentTopOffset,
              ...textContainerStyle,
              minHeight: contentHeight,
              height: contentHeight,
              justifyContent: 'flex-start'
            }}
          >
            {renderTextContent()}
          </div>
        </div>
      )}
    </div>
  );
}
