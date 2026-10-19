import React, { useMemo, useRef } from 'react'
import { styles } from '../../styles'
import { SlideRenderer } from '../SlideRenderer'
import type { SlideData, TextLine } from '../../enbx/parser'
import type { TextStyleCommand, TextStyleState } from '../text-style-commands'
import {
  buildLineRevealClipPath,
  CIRCLE_IN_END_CLIP_PATH,
  CIRCLE_IN_START_CLIP_PATH,
  CIRCLE_IN_TRANSITION_KEY,
  DEFAULT_TRANSFORM,
  FADE_TRANSITION_KEY,
  LINE_REVEAL_TRANSITION_KEY,
  resolveEnteringStartTransform,
  resolveLeavingTargetTransform,
  type LayerSnapshot,
  type TransitionState
} from './constants'

interface SlideViewerLayerProps {
  slideItem: SlideData
  index: number
  currentIndex: number
  slideScale: number
  resourceMap: Record<string, string>
  transitionState: TransitionState | null
  snapshot?: LayerSnapshot
  lineRevealProgress: number
  setLayerRef: (index: number, node: HTMLDivElement | null) => void
  isEditMode: boolean
  elementDisplayStyles?: Record<string, React.CSSProperties>
  elementRenderStates?: Record<string, boolean>
  onElementClick?: (elementId: string) => boolean
  onEditElementDrag?: (elementId: string, nextX: number, nextY: number) => void
  onEditElementResize?: (
    elementId: string,
    nextX: number,
    nextY: number,
    nextWidth: number,
    nextHeight: number
  ) => void
  onEditTextUpdate?: (elementId: string, nextTextLines: TextLine[]) => void
  onEditAudioUpdate?: (elementId: string, edit: import('../../viewer/audio-editing').AudioEdit) => void
  onEditTextStyleStateChange?: (state: TextStyleState | null) => void
  selectedElementId?: string | null
  textStyleCommand?: TextStyleCommand | null
}

export function SlideViewerLayer({
  slideItem,
  index,
  currentIndex,
  slideScale,
  resourceMap,
  transitionState,
  snapshot,
  lineRevealProgress,
  setLayerRef,
  isEditMode,
  elementDisplayStyles,
  elementRenderStates,
  onElementClick,
  onEditElementDrag,
  onEditElementResize,
  onEditTextUpdate,
  onEditAudioUpdate,
  onEditTextStyleStateChange,
  selectedElementId,
  textStyleCommand
}: SlideViewerLayerProps) {
  const isCurrent = index === currentIndex
  const visited = useRef(false)
  if (isCurrent) visited.current = true
  const crossPlaySlide = useMemo(() => ({ ...slideItem,
    elements: slideItem.elements.filter(element => (element.type === 'video' || element.type === 'audio') && element.isCrossSlidePlay)
  }), [slideItem])
  const isEntering = transitionState?.enteringIndex === index
  const isLeaving = transitionState?.leavingIndex === index
  const isAnimating = Boolean(isEntering || isLeaving)
  const isTransitionRunning = transitionState?.phase === 'running'
  const transitionKey = transitionState?.key || 'None'
  const isReverseBackTransition = Boolean(transitionState?.isReverseBackTransition)
  const shouldUseMaskTopLayer =
    transitionKey === CIRCLE_IN_TRANSITION_KEY || transitionKey === LINE_REVEAL_TRANSITION_KEY
  const zIndex = shouldUseMaskTopLayer
    ? transitionKey === LINE_REVEAL_TRANSITION_KEY
      ? isLeaving ? 2 : isCurrent ? 1 : 0
      : isReverseBackTransition
        ? isEntering ? 2 : isCurrent ? 1 : 0
        : isLeaving ? 2 : isCurrent ? 1 : 0
    : isCurrent ? 2 : isLeaving ? 1 : 0
  const isFadeTransition = transitionKey === FADE_TRANSITION_KEY
  const isCircleIn = transitionKey === CIRCLE_IN_TRANSITION_KEY
  const isLineReveal = transitionKey === LINE_REVEAL_TRANSITION_KEY
  const isCircleInReverse = isCircleIn && isReverseBackTransition
  const currentLineRevealProgress = isTransitionRunning ? lineRevealProgress : 0
  const lineRevealClipPath = buildLineRevealClipPath(
    currentLineRevealProgress,
    isReverseBackTransition
  )
  const enteringStartTransform = resolveEnteringStartTransform(
    transitionKey,
    isReverseBackTransition
  )
  const leavingTargetTransform = resolveLeavingTargetTransform(
    transitionKey,
    isReverseBackTransition
  )
  const layerOpacity = isEntering
    ? isFadeTransition
      ? isTransitionRunning ? 1 : snapshot?.opacity ?? 0
      : snapshot?.opacity ?? 1
    : isLeaving
      ? isFadeTransition
        ? isTransitionRunning ? 0 : snapshot?.opacity ?? 1
        : snapshot?.opacity ?? 1
      : 1
  const layerTransform = isEntering
    ? isTransitionRunning
      ? DEFAULT_TRANSFORM
      : isFadeTransition
        ? snapshot?.transform ?? DEFAULT_TRANSFORM
        : enteringStartTransform
    : isLeaving
      ? isTransitionRunning
        ? leavingTargetTransform
        : isFadeTransition
          ? snapshot?.transform ?? DEFAULT_TRANSFORM
          : DEFAULT_TRANSFORM
      : DEFAULT_TRANSFORM
  const layerClipPath = isCircleIn
    ? isCircleInReverse
      ? isEntering
        ? isTransitionRunning ? CIRCLE_IN_START_CLIP_PATH : CIRCLE_IN_END_CLIP_PATH
        : undefined
      : isLeaving
        ? isTransitionRunning ? CIRCLE_IN_END_CLIP_PATH : CIRCLE_IN_START_CLIP_PATH
        : undefined
    : isLineReveal
      ? isLeaving
        ? lineRevealClipPath
        : undefined
      : undefined
  const layerTransition = isAnimating && isTransitionRunning
    ? isCircleIn
      ? `clip-path ${transitionState?.durationMs || 0}ms ease`
      : isLineReveal
        ? 'none'
        : `transform ${transitionState?.durationMs || 0}ms ease, opacity ${transitionState?.durationMs || 0}ms ease`
    : 'none'
  const currentSlideNumber = currentIndex + 1
  const sourceSlideNumber = index + 1
  const shouldKeepAliveForCrossPlay = !isEditMode && visited.current && slideItem.elements.some(
    element => (element.type === 'video' || element.type === 'audio')
      && element.isCrossSlidePlay
      && currentSlideNumber > sourceSlideNumber
      && (
        element.stopPlayPageNumber <= 0
        || currentSlideNumber < element.stopPlayPageNumber
      )
  )

  if (!isCurrent && !isEntering && !isLeaving && !shouldKeepAliveForCrossPlay) return null
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex,
        visibility: isCurrent || isLeaving || shouldKeepAliveForCrossPlay ? 'visible' : 'hidden',
        opacity: isCurrent || isLeaving ? 1 : 0,
        pointerEvents: isCurrent ? 'auto' : 'none'
      }}
    >
      <div
        ref={node => {
          setLayerRef(index, node)
        }}
        style={{
          ...styles.slideLayerContainer,
          transform: layerTransform,
          opacity: layerOpacity,
          clipPath: layerClipPath,
          transition: layerTransition,
          willChange: isAnimating
            ? isCircleIn
              ? 'clip-path'
              : isLineReveal
                ? 'clip-path'
                : 'transform, opacity'
            : undefined
        }}
      >
        <SlideRenderer
          slide={isCurrent || isEntering || isLeaving ? slideItem : crossPlaySlide}
          scale={slideScale}
          resourceMap={resourceMap}
          slideIndex={index}
          currentIndex={currentIndex}
          elementDisplayStyles={!isEditMode && isCurrent ? elementDisplayStyles : undefined}
          elementRenderStates={!isEditMode && isCurrent ? elementRenderStates : undefined}
          onElementClick={isCurrent ? onElementClick : undefined}
          onEditElementDrag={isCurrent && isEditMode ? onEditElementDrag : undefined}
          onEditElementResize={isCurrent && isEditMode ? onEditElementResize : undefined}
          onEditTextUpdate={isCurrent && isEditMode ? onEditTextUpdate : undefined}
          onEditAudioUpdate={isCurrent && isEditMode ? onEditAudioUpdate : undefined}
          onEditTextStyleStateChange={isCurrent && isEditMode ? onEditTextStyleStateChange : undefined}
          isEditMode={isEditMode}
          selectedElementId={isCurrent && isEditMode ? selectedElementId : null}
          textStyleCommand={isCurrent && isEditMode ? textStyleCommand : null}
        />
      </div>
    </div>
  )
}
