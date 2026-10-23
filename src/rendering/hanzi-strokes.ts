import { hanziStrokeCharacters } from './hanzi-stroke-characters'

export interface HanziStroke {
  outline: string
  animationPath: string
  length: number
  duration: number
}

const available = new Set(hanziStrokeCharacters)
const cache = new Map<string, Promise<Record<string, [string, string][]>>>()

export function hasHanziStrokes(character: string) {
  return available.has(character)
}

/** 官方轨迹为整数 M/L 折线，速度每个内部坐标单位 8ms，最短 160ms。 */
export function decodeHanziStroke([outline, animationPath]: [string, string]): HanziStroke {
  const points = [...animationPath.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)]
    .map(match => [Number(match[1]), Number(match[2])])
  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  }
  return { outline, animationPath, length, duration: Math.max(160, length * 8) }
}

/** 本地分片按需加载并共享请求，失败请求可再次重试。 */
export async function loadHanziStrokes(character: string): Promise<HanziStroke[] | null> {
  if (!hasHanziStrokes(character)) return null
  const shard = (character.codePointAt(0)! >> 8).toString(16)
  let pending = cache.get(shard)
  if (!pending) {
    const base = import.meta.env?.BASE_URL || '/'
    pending = fetch(`${base}hanzi-strokes/${shard}.json`).then(async response => {
      if (!response.ok) throw new Error('笔顺资源加载失败')
      return response.json() as Promise<Record<string, [string, string][]>>
    })
    cache.set(shard, pending)
    void pending.catch(() => { if (cache.get(shard) === pending) cache.delete(shard) })
  }
  const entries = (await pending)[character]
  if (!Array.isArray(entries) || !entries.length) throw new Error('笔顺资源不完整')
  return entries.map(decodeHanziStroke)
}
