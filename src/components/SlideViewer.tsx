import { useState, useEffect, useRef, useCallback } from 'react';
import { styles } from '../styles';
import { SlideRenderer } from './SlideRenderer';
import type { SlideData } from '../parser';

interface SlideViewerProps {
  slide: SlideData;
  resourceMap?: Record<string, string>;
}

export function SlideViewer({ slide, resourceMap = {} }: SlideViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // 计算合适的缩放比例，使幻灯片完全适应容器（减去底部栏高度）
  const calculateScale = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const infoBarHeight = 40; // 底部信息栏高度
    const containerWidth = container.clientWidth - 48; // 减去 padding
    const containerHeight = container.clientHeight - 48 - infoBarHeight;

    const slideWidth = slide.width;
    const slideHeight = slide.height;

    const scaleX = containerWidth / slideWidth;
    const scaleY = containerHeight / slideHeight;

    const newScale = Math.min(scaleX, scaleY, 1);
    
    setScale(newScale);
  }, [slide.width, slide.height]);

  // 监听窗口大小变化
  useEffect(() => {
    calculateScale();

    const handleResize = () => {
      calculateScale();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateScale]);

  return (
    <div style={styles.slideViewerContainer}>
      {/* 幻灯片容器 */}
      <div ref={containerRef} style={styles.slideContainer}>
        <div style={{ ...styles.slideWrapper, paddingBottom: '40px' }}>
          <SlideRenderer slide={slide} scale={scale} resourceMap={resourceMap} />
        </div>
      </div>

      {/* 底部信息栏 - 绝对定位贴底 */}
      <div style={styles.slideInfoBar}>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>尺寸:</span>
          <span>{slide.width}×{slide.height}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>缩放:</span>
          <span>{Math.round(scale * 100)}%</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>背景:</span>
          <span style={styles.colorPreview}>
            <span
              style={{
                ...styles.colorBox,
                backgroundColor: slide.backgroundColor,
                backgroundImage: slide.backgroundImage ? `url(${resourceMap[slide.backgroundImage]})` : undefined,
                backgroundSize: 'cover',
              }}
            />
            {slide.backgroundImage ? '图片' : slide.backgroundColor}
          </span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>文本:</span>
          <span>{slide.elements.length}</span>
        </div>
      </div>
    </div>
  );
}
