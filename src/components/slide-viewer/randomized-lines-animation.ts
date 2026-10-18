import type { BlindDirection } from './constants'

const STRIP_COUNT = 40
const KEYFRAME_PREFIX = 'seewo-element-randomized-lines-in'

export function isRandomizedLinesInAnimation(type: string): boolean {
  return type.trim().toLowerCase() === 'randomizedlinesineffect'
}

export function buildRandomizedLinesInKeyframeName(direction: BlindDirection): string {
  return `${KEYFRAME_PREFIX}-${direction}`
}

// 固定乱序，重播与回退后再次播放时不会改变条纹位置。
export function resolveRandomizedLineOrder(): number[] {
  const order = Array.from({ length: STRIP_COUNT }, (_, index) => index)
  let seed = 0x5ee0
  for (let index = order.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const target = seed % (index + 1)
    ;[order[index], order[target]] = [order[target], order[index]]
  }
  return order
}

export function buildRandomizedLinesMask(direction: BlindDirection, revealedCount: number): string {
  const order = resolveRandomizedLineOrder()
  const count = Math.max(0, Math.min(STRIP_COUNT, Math.floor(revealedCount)))
  const strips = order.slice(0, count).map(index => direction === 'Horizontal'
    ? `<rect x="0" y="${index}" width="${STRIP_COUNT}" height="1"/>`
    : `<rect x="${index}" y="0" width="1" height="${STRIP_COUNT}"/>`)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STRIP_COUNT} ${STRIP_COUNT}" preserveAspectRatio="none"><g fill="white">${strips.join('')}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function buildRandomizedLinesInKeyframesCss(): string {
  return (['Horizontal', 'Vertical'] as const).map(direction => {
    const frames = Array.from({ length: STRIP_COUNT + 1 }, (_, count) => {
      const mask = buildRandomizedLinesMask(direction, count)
      return `${count / STRIP_COUNT * 100}% {
        opacity: 1;
        -webkit-mask-image: ${mask};
        mask-image: ${mask};
        -webkit-mask-size: 100% 100%;
        mask-size: 100% 100%;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
      }`
    })
    return `@keyframes ${buildRandomizedLinesInKeyframeName(direction)} { ${frames.join('\n')} }`
  }).join('\n')
}
