/** 参数来自官方 ClassifyAccept/ExceptAnimation 的 Storyboard，单位为页面设计像素。 */
export function playClassificationFeedback(material: HTMLElement, container: HTMLElement | null,
  correct: boolean, returnOffset: { x: number; y: number }, onComplete: () => void) {
  const animations: Animation[] = []
  let finished = false
  const animate = (node: HTMLElement | null, frames: Keyframe[], duration: number, delay = 0) => {
    if (node?.animate) animations.push(node.animate(frames, { duration, delay, fill: 'forwards', easing: 'linear' }))
  }
  const duration = correct ? 400 : 700
  const complete = () => {
    if (finished) return
    finished = true
    clearTimeout(timer)
    animations.forEach(animation => animation.cancel())
    onComplete()
  }
  if (correct) {
    animate(container, [{ scale: '1.2', offset: 0 }, { scale: '1.3', offset: 1 / 3 },
      { scale: '0.8', offset: 2 / 3 }, { scale: '1', offset: 1 }], 300)
    animate(material, [{ scale: '1' }, { scale: '0' }], 400)
  } else {
    animate(container, [{ scale: '1.2', offset: 0 }, { scale: '1.2', offset: 5 / 7 }, { scale: '1', offset: 1 }], 700)
    animate(container, [0, -60, 0, -40, 0, -20, 0].map((y, index) => ({
      translate: `0px ${y}px`, offset: [0, 0.2, 0.4, 0.6, 0.8, 0.9, 1][index]
    })), 500)
    animate(material, [{ translate: '0px 0px' }, { translate: `${returnOffset.x}px ${returnOffset.y}px` }], 200, 500)
    const last = animations[animations.length - 1]
    if (last) last.effect?.updateTiming({ easing: 'cubic-bezier(0, 0.7, 0.7, 1)' })
  }
  // 定时器也覆盖不支持 WAAPI 或后台页未派发 finish 的浏览器。
  const timer = setTimeout(complete, duration)
  return complete
}
