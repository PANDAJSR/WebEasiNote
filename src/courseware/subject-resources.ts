import type { SlideData } from '../types'

/** 仅补读学科卡片显式引用的逻辑路径，不扫描或预加载整个资源目录。 */
export function subjectResourcePaths(slides: SlideData[]) {
  const paths = new Set<string>()
  const add = (source: string) => {
    const path = source.trim().replace(/\\/g, '/')
    if (!path || /[:?#]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) return
    paths.add(path)
  }
  for (const slide of slides) for (const element of slide.elements) {
    if (element.type === 'englishWordCard') {
      add(element.pronounceSource)
      element.synonyms.forEach(item => add(item.pronounceSource))
    } else if (element.type === 'hanziCard') {
      element.pronounceList.forEach(item => add(item.source))
    } else if (element.type === 'pinyinCard') {
      element.pinyins.forEach(item => item.pronounceList.forEach(resource => add(resource.source)))
    } else if (element.type === 'resourceCard') {
      add(element.thumbnail)
      add(element.icon)
      add(element.buttonImage)
    } else if (element.type === 'questionCard') {
      add(element.question)
      add(element.options)
      add(element.answer)
      add(element.analysis)
    } else if (element.type === 'dictationCard') {
      element.words.forEach(word => { add(word.maleAudio); add(word.femaleAudio) })
    } else if (element.type === 'vocabularyPage') {
      add(element.pronounceSource)
      element.synonyms.forEach(item => add(item.pronounceSource))
    } else if (element.type === 'solarSystem') {
      Object.values(element.textures).forEach(add)
      Object.values(element.maps).forEach(add)
    }
  }
  return paths
}
