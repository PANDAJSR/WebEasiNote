import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  parseENBXFile, 
  parseExtractedFolder, 
  loadSlidesFromENBX, 
  loadSlidesFromFolder,
  type CoursewareMetadata,
  type SlideData 
} from './parser';
import { parseReferenceXML } from './pictures';
import { WelcomeView } from './components/WelcomeView';
import { LoadingView } from './components/LoadingView';
import { ErrorView } from './components/ErrorView';
import { Viewer } from './components/Viewer';
import { styles } from './styles';

// 添加CSS动画
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

type ViewMode = 'welcome' | 'loading' | 'error' | 'viewer';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [metadata, setMetadata] = useState<CoursewareMetadata | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resourceMap, setResourceMap] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.enbx')) {
      setError('请选择 .enbx 格式的文件');
      setViewMode('error');
      return;
    }

    console.log('='.repeat(60));
    console.log('[App] 开始解析 ENBX 文件:', file.name);
    console.log('='.repeat(60));

    setViewMode('loading');
    setError(null);

    try {
      const zip = await JSZip.loadAsync(file);
      console.log('[App] ZIP 文件加载成功');
      
      // 列出 ZIP 中的所有文件
      console.log('[App] ZIP 内容列表:');
      zip.forEach((relativePath, zipEntry) => {
        console.log(`  - ${relativePath} (${zipEntry.dir ? '目录' : '文件'})`);
      });
      
      // 加载 Reference.xml 构建资源映射
      const referenceFile = zip.file('Reference.xml');
      let map: Record<string, string> = {};
      if (referenceFile) {
        console.log('[App] 找到 Reference.xml, 开始解析...');
        const refXml = await referenceFile.async('text');
        map = parseReferenceXML(refXml);
        console.log(`[App] Reference.xml 解析完成, 共 ${Object.keys(map).length} 个资源映射`);
      } else {
        console.warn('[App] 未找到 Reference.xml');
      }
      
      // 加载所有图片资源
      console.log('[App] 开始加载图片资源...');
      const loadedMap: Record<string, string> = {};
      let loadedCount = 0;
      let failedCount = 0;
      
      for (const [id, filePath] of Object.entries(map)) {
        const imgFile = zip.file(filePath);
        if (imgFile) {
          try {
            const blob = await imgFile.async('blob');
            loadedMap[id] = URL.createObjectURL(blob);
            loadedCount++;
          } catch (error) {
            failedCount++;
            console.warn(`[App] 图片加载失败: ${filePath}`, error);
          }
        } else {
          failedCount++;
          console.warn(`[App] ZIP中未找到图片: ${filePath}`);
        }
      }
      console.log(`[App] 图片资源加载完成: ${loadedCount} 成功, ${failedCount} 失败`);
      
      console.log('[App] 开始解析课件元数据...');
      const meta = await parseENBXFile(file);
      console.log('[App] 课件元数据解析完成:', meta.name);
      
      console.log('[App] 开始解析幻灯片数据...');
      const slideData = await loadSlidesFromENBX(file);
      console.log(`[App] 幻灯片数据解析完成: ${slideData.length} 页`);
      
      // 汇总统计
      const totalElements = slideData.reduce((sum, slide) => sum + slide.elements.length, 0);
      console.log('='.repeat(60));
      console.log('[App] 解析完成汇总:');
      console.log(`  - 课件名称: ${meta.name}`);
      console.log(`  - 幻灯片数量: ${slideData.length}`);
      console.log(`  - 元素总数: ${totalElements}`);
      console.log(`  - 图片资源: ${loadedCount}/${Object.keys(map).length}`);
      console.log('='.repeat(60));
      
      setMetadata(meta);
      setSlides(slideData);
      setResourceMap(loadedMap);
      setCurrentSlideIndex(0);
      setViewMode('viewer');
    } catch (err) {
      console.error('[App] 解析失败:', err);
      setError((err as Error).message);
      setViewMode('error');
    }
  };

  const handleFolderSelect = async () => {
    if (!('showDirectoryPicker' in window)) {
      setError('您的浏览器不支持文件夹选择功能，请使用 Chrome 或 Edge 浏览器');
      setViewMode('error');
      return;
    }

    setViewMode('loading');
    setError(null);

    try {
      const dirHandle = await window.showDirectoryPicker();
      
      // 加载 Reference.xml
      let map: Record<string, string> = {};
      try {
        const refFile = await dirHandle.getFileHandle('Reference.xml');
        const refBlob = await refFile.getFile();
        const refXml = await refBlob.text();
        map = parseReferenceXML(refXml);
      } catch {
        // Reference.xml 可能不存在
      }
      
      // 加载图片资源
      const loadedMap: Record<string, string> = {};
      let resourcesHandle: FileSystemDirectoryHandle | null = null;
      try {
        resourcesHandle = await dirHandle.getDirectoryHandle('Resources');
      } catch {
        // Resources 文件夹可能不存在
      }
      
      if (resourcesHandle) {
        for (const [id, filePath] of Object.entries(map)) {
          const fileName = filePath.split('/').pop();
          if (!fileName) continue;
          
          try {
            const fileHandle = await resourcesHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            loadedMap[id] = URL.createObjectURL(file);
          } catch {
            // 忽略加载失败的图片
          }
        }
      }
      
      const meta = await parseExtractedFolder(dirHandle);
      const slideData = await loadSlidesFromFolder(dirHandle);
      
      setMetadata(meta);
      setSlides(slideData);
      setResourceMap(loadedMap);
      setCurrentSlideIndex(0);
      setViewMode('viewer');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setViewMode('welcome');
        return;
      }
      setError((err as Error).message);
      setViewMode('error');
    }
  };

  const handleClear = () => {
    // 清理 blob URLs
    Object.values(resourceMap).forEach(url => {
      URL.revokeObjectURL(url);
    });
    
    setMetadata(null);
    setSlides([]);
    setResourceMap({});
    setCurrentSlideIndex(0);
    setError(null);
    setViewMode('welcome');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSlideChange = (index: number) => {
    setCurrentSlideIndex(index);
  };

  useEffect(() => {
    if (viewMode !== 'viewer') return
    if (slides.length === 0) return

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tagName = target.tagName
      return (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target.isContentEditable
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        setCurrentSlideIndex(prev => Math.max(prev - 1, 0))
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        setCurrentSlideIndex(prev => Math.min(prev + 1, slides.length - 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, slides.length])

  return (
    <div style={styles.container}>
      {viewMode === 'welcome' && (
        <WelcomeView 
          onFileSelect={handleFileSelect}
          onFolderSelect={handleFolderSelect}
          fileInputRef={fileInputRef}
        />
      )}
      {viewMode === 'loading' && <LoadingView />}
      {viewMode === 'error' && error && (
        <ErrorView error={error} onBack={handleClear} />
      )}
      {viewMode === 'viewer' && metadata && (
        <Viewer
          metadata={metadata}
          slides={slides}
          currentIndex={currentSlideIndex}
          onSlideChange={handleSlideChange}
          onClear={handleClear}
          resourceMap={resourceMap}
        />
      )}
    </div>
  );
}

export default App;
