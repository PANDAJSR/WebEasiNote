import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SlideData } from '../../parser'
import type { SlideChangeSource } from '../Viewer'
import {
  DEFAULT_FADE_DURATION_MS,
  DEFAULT_TRANSFORM,
  ENABLE_TRANSITION_DEBUG_LOG,
  FADE_TRANSITION_KEY,
  isCircleInTransition,
  isDirectionalSlideTransition,
  isLineRevealTransition,
  LINE_REVEAL_TRANSITION_KEY,
  MAX_FADE_DURATION_MS,
  normalizeTransitionKey,
  type LayerSnapshot,
  type TransitionState
} from './constants'

interface UseSlideTransitionsParams {
  slides: SlideData[]
  currentIndex: number
  slideChangeSource: SlideChangeSource
}

export function useSlideTransitions({ slides, currentIndex, slideChangeSource }: UseSlideTransitionsParams) {
  const previousIndexRef = useRef(currentIndex)
  const [transitionState, setTransitionState] = useState<TransitionState | null>(null)
  const [layerSnapshots, setLayerSnapshots] = useState<Record<number, LayerSnapshot>>({})
  const [lineRevealProgress, setLineRevealProgress] = useState(0)
  const leaveAnimationTimerRef = useRef<number | null>(null)
  const transitionRafRef = useRef<number | null>(null)
  const lineRevealRafRef = useRef<number | null>(null)
  const transitionIdRef = useRef(0)
  const layerRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const setLayerRef = useCallback((index: number, node: HTMLDivElement | null) => {
    layerRefs.current[index] = node
  }, [])

  const logTransitionDebug = useCallback((message: string, payload?: Record<string, unknown>) => {
    if (!ENABLE_TRANSITION_DEBUG_LOG) return
    if (payload) {
      console.log(`[SlideViewer] ${message}`, payload)
      return
    }
    console.log(`[SlideViewer] ${message}`)
  }, [])

  const logLayerComputedStyle = useCallback((label: string, index: number) => {
    if (!ENABLE_TRANSITION_DEBUG_LOG) return
    const layer = layerRefs.current[index]
    if (!layer) {
      console.log(`[SlideViewer] ${label}`, { index, missing: true })
      return
    }
    const computedStyle = window.getComputedStyle(layer)
    console.log(`[SlideViewer] ${label}`, {
      index,
      opacity: computedStyle.opacity,
      transform: computedStyle.transform,
      transition: computedStyle.transition
    })
  }, [])

  useLayoutEffect(() => {
    if (previousIndexRef.current === currentIndex) return
    const previousIndex = previousIndexRef.current
    const nextSlide = slides[currentIndex]
    const leavingSlide = previousIndex >= 0 ? slides[previousIndex] : undefined
    const isBackward = currentIndex < previousIndex
    const isNonThumbnailBack = isBackward && slideChangeSource !== 'thumbnail'
    const activeTransitionFromSlide = isNonThumbnailBack ? leavingSlide : nextSlide
    const resolvedTransitionKey = normalizeTransitionKey(
      activeTransitionFromSlide?.transition?.key || 'None'
    )
    const shouldAnimateTransition =
      resolvedTransitionKey === FADE_TRANSITION_KEY
      || isDirectionalSlideTransition(resolvedTransitionKey)
      || isCircleInTransition(resolvedTransitionKey)
      || isLineRevealTransition(resolvedTransitionKey)
    const rawDuration = activeTransitionFromSlide?.transition?.durationMs ?? DEFAULT_FADE_DURATION_MS
    const transitionDurationMs = Math.max(0, Math.min(rawDuration, MAX_FADE_DURATION_MS))
    const shouldUseReverseBackTransition =
      isNonThumbnailBack
      && (
        isDirectionalSlideTransition(resolvedTransitionKey)
        || isCircleInTransition(resolvedTransitionKey)
        || isLineRevealTransition(resolvedTransitionKey)
      )

    logTransitionDebug('检测翻页', {
      previousIndex,
      currentIndex,
      slideChangeSource,
      resolvedTransitionKey,
      transitionDurationMs,
      isBackward,
      isNonThumbnailBack,
      shouldAnimateTransition,
      shouldUseReverseBackTransition
    })

    const clearTransitionTimer = () => {
      if (leaveAnimationTimerRef.current !== null) {
        window.clearTimeout(leaveAnimationTimerRef.current)
        leaveAnimationTimerRef.current = null
      }
    }

    const clearTransitionRaf = () => {
      if (transitionRafRef.current !== null) {
        window.cancelAnimationFrame(transitionRafRef.current)
        transitionRafRef.current = null
      }
    }

    if (leaveAnimationTimerRef.current !== null) {
      clearTransitionTimer()
    }

    if (transitionRafRef.current !== null) {
      clearTransitionRaf()
    }

    if (lineRevealRafRef.current !== null) {
      window.cancelAnimationFrame(lineRevealRafRef.current)
      lineRevealRafRef.current = null
    }
    setLineRevealProgress(0)

    if (shouldAnimateTransition && previousIndex >= 0 && previousIndex !== currentIndex) {
      const nextSnapshots: Record<number, LayerSnapshot> = {}
      if (transitionState) {
        ;[transitionState.enteringIndex, transitionState.leavingIndex].forEach(index => {
          const layer = layerRefs.current[index]
          if (!layer) return
          const computedStyle = window.getComputedStyle(layer)
          nextSnapshots[index] = {
            opacity: parseFloat(computedStyle.opacity) || 0,
            transform: computedStyle.transform === 'none' ? DEFAULT_TRANSFORM : computedStyle.transform
          }
        })
      }

      const transitionId = transitionIdRef.current + 1
      transitionIdRef.current = transitionId
      setLayerSnapshots(nextSnapshots)
      setTransitionState({
        id: transitionId,
        enteringIndex: currentIndex,
        leavingIndex: previousIndex,
        key: resolvedTransitionKey,
        durationMs: transitionDurationMs,
        isReverseBackTransition: shouldUseReverseBackTransition,
        phase: 'prepare'
      })
      logTransitionDebug('进入 prepare 阶段', {
        transitionId,
        enteringIndex: currentIndex,
        leavingIndex: previousIndex,
        key: resolvedTransitionKey,
        durationMs: transitionDurationMs
      })
      transitionRafRef.current = window.requestAnimationFrame(() => {
        transitionRafRef.current = window.requestAnimationFrame(() => {
          setTransitionState(state => {
            if (!state || state.id !== transitionId) return state
            logTransitionDebug('切换到 running 阶段', {
              transitionId,
              enteringIndex: state.enteringIndex,
              leavingIndex: state.leavingIndex,
              key: state.key,
              durationMs: state.durationMs
            })
            return { ...state, phase: 'running' }
          })
          transitionRafRef.current = null
        })
      })
    } else {
      logTransitionDebug('不执行转场动画，直接切换', {
        previousIndex,
        currentIndex,
        resolvedTransitionKey
      })
      setTransitionState(null)
      setLayerSnapshots({})
    }

    previousIndexRef.current = currentIndex
  }, [currentIndex, slides, slideChangeSource, transitionState, logTransitionDebug])

  useEffect(() => {
    if (!transitionState) return
    logTransitionDebug('当前 transitionState', {
      id: transitionState.id,
      phase: transitionState.phase,
      key: transitionState.key,
      durationMs: transitionState.durationMs,
      enteringIndex: transitionState.enteringIndex,
      leavingIndex: transitionState.leavingIndex
    })
    logLayerComputedStyle('样式快照(同步)', transitionState.enteringIndex)
    logLayerComputedStyle('样式快照(同步)', transitionState.leavingIndex)
    const rafId = window.requestAnimationFrame(() => {
      logLayerComputedStyle('样式快照(下一帧)', transitionState.enteringIndex)
      logLayerComputedStyle('样式快照(下一帧)', transitionState.leavingIndex)
    })
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [transitionState, logLayerComputedStyle, logTransitionDebug])

  useEffect(() => {
    if (!transitionState || transitionState.phase !== 'running') return
    logTransitionDebug('running 阶段开始计时', {
      transitionId: transitionState.id,
      durationMs: transitionState.durationMs
    })
    leaveAnimationTimerRef.current = window.setTimeout(() => {
      logTransitionDebug('转场计时结束，清理状态', {
        transitionId: transitionState.id
      })
      setTransitionState(null)
      setLayerSnapshots({})
      leaveAnimationTimerRef.current = null
    }, transitionState.durationMs)

    return () => {
      if (leaveAnimationTimerRef.current !== null) {
        logTransitionDebug('清理 running 计时器')
        window.clearTimeout(leaveAnimationTimerRef.current)
        leaveAnimationTimerRef.current = null
      }
    }
  }, [transitionState, logTransitionDebug])

  useEffect(() => {
    if (!transitionState || transitionState.key !== LINE_REVEAL_TRANSITION_KEY) {
      setLineRevealProgress(0)
      if (lineRevealRafRef.current !== null) {
        window.cancelAnimationFrame(lineRevealRafRef.current)
        lineRevealRafRef.current = null
      }
      return
    }

    if (transitionState.phase !== 'running') {
      setLineRevealProgress(0)
      return
    }

    const startTime = performance.now()
    const duration = Math.max(1, transitionState.durationMs)
    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      setLineRevealProgress(progress)
      if (progress < 1) {
        lineRevealRafRef.current = window.requestAnimationFrame(animate)
      } else {
        lineRevealRafRef.current = null
      }
    }

    lineRevealRafRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (lineRevealRafRef.current !== null) {
        window.cancelAnimationFrame(lineRevealRafRef.current)
        lineRevealRafRef.current = null
      }
    }
  }, [transitionState])

  useEffect(() => {
    return () => {
      if (leaveAnimationTimerRef.current !== null) {
        window.clearTimeout(leaveAnimationTimerRef.current)
      }
      if (transitionRafRef.current !== null) {
        window.cancelAnimationFrame(transitionRafRef.current)
      }
      if (lineRevealRafRef.current !== null) {
        window.cancelAnimationFrame(lineRevealRafRef.current)
      }
    }
  }, [])

  return {
    transitionState,
    layerSnapshots,
    lineRevealProgress,
    setLayerRef
  }
}
