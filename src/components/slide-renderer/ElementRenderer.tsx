import type { SlideElement, UnknownElement, TopicElement, CylinderElement, ConeElement, CubeElement, GeometryElement, MathFormulaElement } from '../../enbx/parser'
import type { ShapeElement } from '../../enbx/shapes'
import type { PictureElement } from '../../enbx/pictures'
import type { VideoElement } from '../../enbx/videos'
import type { FlashElement } from '../../enbx/flashes'
import type { TableElement } from '../../types'
import { ShapeRenderer } from '../ShapeRenderer'
import { ViewRenderer } from '../view/ViewRenderer'
import { PictureRenderer } from '../PictureRenderer'
import { VideoRenderer } from '../VideoRenderer'
import { AudioRenderer } from '../AudioRenderer'
import { FlashRenderer } from '../FlashRenderer'
import { TableRenderer } from '../TableRenderer'
import { TopicRenderer } from '../TopicRenderer'
import { CylinderRenderer } from '../CylinderRenderer'
import { ConeRenderer } from '../ConeRenderer'
import { CubeRenderer } from '../CubeRenderer'
import { GeometryRenderer } from '../GeometryRenderer'
import { MathFormulaRenderer } from '../MathFormulaRenderer'
import { TextElementRenderer } from './TextElementRenderer'
import { EnglishWordCardRenderer } from '../subject-cards/EnglishWordCardRenderer'
import { HanziCardRenderer, PinyinCardRenderer } from '../subject-cards/ChineseCardRenderer'
import { ClassicalWorkRenderer } from '../subject-cards/ClassicalWorkRenderer'
import { VocabularyPageRenderer } from '../subject-cards/VocabularyPageRenderer'
import { ResourceCardRenderer } from '../subject-cards/ResourceCardRenderer'
import { QuestionCardRenderer } from '../subject-cards/QuestionCardRenderer'
import { DictationCardRenderer } from '../subject-cards/DictationCardRenderer'
import { ChartRenderer } from '../subject-cards/ChartRenderer'
import { MathFunctionRenderer } from '../subject-cards/MathFunctionRenderer'
import { SolarSystemRenderer } from '../subject-cards/SolarSystemRenderer'
import { ActivityElementRenderer } from '../activities/ActivityElementRenderer'

interface ElementRendererProps {
  element: SlideElement
  scale: number
  resourceMap: Record<string, string>
  slideIndex: number
  currentIndex: number
  isEditMode?: boolean
  onEditAudioUpdate?: (elementId: string, edit: import('../../viewer/audio-editing').AudioEdit) => void
  isVisible?: boolean
  slideWidth?: number
  slideHeight?: number
}

export function ElementRenderer({
  element,
  scale,
  resourceMap,
  slideIndex,
  currentIndex,
  isEditMode = false,
  onEditAudioUpdate,
  isVisible = true,
  slideWidth = 1280,
  slideHeight = 720
}: ElementRendererProps) {
  switch (element.type) {
    case 'view':
      return <ViewRenderer element={element} scale={scale} resourceMap={resourceMap} slideIndex={slideIndex}
        currentIndex={currentIndex} isEditMode={isEditMode} onEditAudioUpdate={onEditAudioUpdate}
        isVisible={isVisible} slideWidth={slideWidth} slideHeight={slideHeight} />
    case 'activity':
      return <ActivityElementRenderer element={element} scale={scale} resourceMap={resourceMap}
        slideIndex={slideIndex} currentIndex={currentIndex} isEditMode={isEditMode} />
    case 'mathFunction':
      return <MathFunctionRenderer element={element} scale={scale} active={slideIndex === currentIndex && isVisible && !isEditMode} />
    case 'solarSystem':
      return <SolarSystemRenderer element={element} scale={scale} resourceMap={resourceMap} active={slideIndex === currentIndex && isVisible && !isEditMode} />
    case 'classicalWork':
      return <ClassicalWorkRenderer element={element} scale={scale} active={slideIndex === currentIndex && isVisible && !isEditMode} />
    case 'vocabularyPage':
      return <VocabularyPageRenderer element={element} scale={scale} resourceMap={resourceMap} active={slideIndex === currentIndex && isVisible && !isEditMode} />
    case 'resourceCard':
      return <ResourceCardRenderer element={element} scale={scale} resourceMap={resourceMap} active={slideIndex === currentIndex && isVisible && !isEditMode} />
    case 'questionCard':
      return <QuestionCardRenderer element={element} scale={scale} resourceMap={resourceMap} active={slideIndex === currentIndex && isVisible && !isEditMode} />
    case 'dictationCard':
      return <DictationCardRenderer element={element} scale={scale} resourceMap={resourceMap} active={slideIndex === currentIndex && isVisible && !isEditMode} />
    case 'chart':
      return <ChartRenderer element={element} scale={scale} />
    case 'englishWordCard':
      return <EnglishWordCardRenderer element={element} scale={scale} resourceMap={resourceMap}
        active={slideIndex === currentIndex && isVisible && !isEditMode} />
    case 'hanziCard':
      return <HanziCardRenderer element={element} scale={scale} resourceMap={resourceMap}
        active={slideIndex === currentIndex && isVisible && !isEditMode} />
    case 'pinyinCard':
      return <PinyinCardRenderer element={element} scale={scale} resourceMap={resourceMap}
        active={slideIndex === currentIndex && isVisible && !isEditMode} />
    case 'text':
      return <TextElementRenderer element={element} scale={scale} />
    case 'shape':
      return <ShapeRenderer element={element as ShapeElement} scale={scale} />
    case 'picture':
      return <PictureRenderer element={element as PictureElement} scale={scale} resourceMap={resourceMap} />
    case 'audio':
      return <AudioRenderer element={element} scale={scale} resourceMap={resourceMap}
        isCurrentSlide={slideIndex === currentIndex} currentSlideNumber={currentIndex + 1}
        sourceSlideNumber={slideIndex + 1} isEditMode={isEditMode} isVisible={isVisible}
        slideWidth={slideWidth} slideHeight={slideHeight} onEditAudioUpdate={onEditAudioUpdate} />
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
    case 'flash':
      return (
        <FlashRenderer
          element={element as FlashElement}
          scale={scale}
          resourceMap={resourceMap}
          isEditMode={isEditMode}
          isCurrentSlide={slideIndex === currentIndex}
        />
      )
    case 'table':
      return <TableRenderer element={element as TableElement} scale={scale} />
    case 'topic':
      return <TopicRenderer element={element as TopicElement} scale={scale} slideWidth={slideWidth} slideHeight={slideHeight} />
    case 'cylinder':
      return <CylinderRenderer element={element as CylinderElement} scale={scale} />
    case 'cone':
      return <ConeRenderer element={element as ConeElement} scale={scale} />
    case 'cube':
      return <CubeRenderer element={element as CubeElement} scale={scale} />
    case 'geometry':
      return <GeometryRenderer element={element as GeometryElement} scale={scale} />
    case 'mathFormula':
      return <MathFormulaRenderer element={element as MathFormulaElement} scale={scale} />
    case 'unknown':
      return <UnknownElementPlaceholder element={element as UnknownElement} scale={scale} />
    default:
      return <UnknownElementPlaceholder element={element} scale={scale} />
  }
}

function UnknownElementPlaceholder({ element, scale }: { element: SlideElement; scale: number }) {
  const x = (element as { x?: number }).x ?? 0
  const y = (element as { y?: number }).y ?? 0
  const width = (element as { width?: number }).width ?? 100
  const height = (element as { height?: number }).height ?? 50
  const id = (element as { id?: string }).id ?? 'unknown'
  const rawType = (element as { type?: string }).type ?? 'unknown'
  const originalType = (element as { originalType?: string }).originalType
  const typeName = originalType || rawType

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
        pointerEvents: 'none'
      }}
    >
      <span style={{ fontWeight: 'bold', marginBottom: 2 * scale }}>⚠️ 无法显示</span>
      <span>类型: {typeName}</span>
      <span style={{ fontSize: 8 * scale, opacity: 0.7, marginTop: 2 * scale }}>
        ID: {id.slice(0, 8)}...
      </span>
    </div>
  )
}
