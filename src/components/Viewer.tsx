import { styles } from '../styles';
import { Sidebar } from './Sidebar';
import { SlideViewer } from './SlideViewer';
import type { CoursewareMetadata, SlideData } from '../parser';

interface ViewerProps {
  metadata: CoursewareMetadata;
  slides: SlideData[];
  currentIndex: number;
  onSlideChange: (index: number) => void;
  onClear: () => void;
  resourceMap?: Record<string, string>;
}

export function Viewer({ 
  metadata, 
  slides, 
  currentIndex, 
  onSlideChange, 
  onClear,
  resourceMap = {}
}: ViewerProps) {
  const currentSlide = slides[currentIndex];

  return (
    <div style={styles.viewerContainer}>
      {/* 顶部工具栏 */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.coursewareName}>{metadata.name}</span>
          <span style={styles.slideInfo}>
            第 {currentIndex + 1} / {slides.length} 页
          </span>
        </div>
        <div style={styles.toolbarRight}>
          <button onClick={onClear} style={styles.clearButton}>
            关闭
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={styles.mainContent}>
        <Sidebar 
          slides={slides} 
          currentIndex={currentIndex}
          onSlideChange={onSlideChange}
        />
        <SlideViewer slide={currentSlide} resourceMap={resourceMap} />
      </div>
    </div>
  );
}
