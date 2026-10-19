import JSZip from 'jszip'
import { parseENBXFile, parseExtractedFolder, loadSlidesFromENBX, loadSlidesFromFolder } from '../enbx/parser'
import { parseReferenceXML } from '../enbx/pictures'
import { revokeObjectUrls } from '../viewer/app-utils'
import type { SlideData } from '../types'
import { getStaticPlan, isStaticRun } from '../rendering/staticPlan'
import { fingerprintRun } from '../rendering/rasterCache'

async function prepareStaticPlans(slides: SlideData[]) {
  for (const slide of slides) {
    try {
      await Promise.all(getStaticPlan(slide).filter(isStaticRun).map(fingerprintRun))
    } catch (error) {
      console.warn('[CoursewareLoader] 静态缓存预热不可用，保留原绘制', error)
    }
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

export async function readCoursewareFile(file: File) {
  const resources: Record<string, string> = {}
  try {
    const zip = await JSZip.loadAsync(file)
    console.log('[App] ZIP 文件加载成功')
    const referenceFile = zip.file('Reference.xml')
    let map: Record<string, string> = {}
    if (referenceFile) {
      const refXml = await referenceFile.async('text')
      map = parseReferenceXML(refXml)
      console.log(`[App] Reference.xml 解析完成, 共 ${Object.keys(map).length} 个资源映射`)
    }
    let loadedCount = 0
    let failedCount = 0
    for (const [id, filePath] of Object.entries(map)) {
      const imgFile = zip.file(filePath)
      if (!imgFile) {
        failedCount++
        continue
      }
      try {
        const blob = await imgFile.async('blob')
        resources[id] = URL.createObjectURL(blob)
        loadedCount++
      } catch {
        failedCount++
      }
    }
    console.log(`[App] 图片资源加载完成: ${loadedCount} 成功, ${failedCount} 失败`)
    const meta = await parseENBXFile(file, zip)
    const slideData = await loadSlidesFromENBX(file, zip)
    await prepareStaticPlans(slideData)
    return { meta, slideData, resources }
  } catch (error) {
    revokeObjectUrls(resources)
    throw error
  }
}

export async function readCoursewareFolder(dirHandle: FileSystemDirectoryHandle) {
  const resources: Record<string, string> = {}
  try {
    let map: Record<string, string> = {}
    try {
      const refFile = await dirHandle.getFileHandle('Reference.xml')
      const refBlob = await refFile.getFile()
      const refXml = await refBlob.text()
      map = parseReferenceXML(refXml)
    } catch {
      // Reference.xml 可能不存在
    }
    let resourcesHandle: FileSystemDirectoryHandle | null = null
    try {
      resourcesHandle = await dirHandle.getDirectoryHandle('Resources')
    } catch {
      // Resources 文件夹可能不存在
    }
    if (resourcesHandle) {
      for (const [id, filePath] of Object.entries(map)) {
        const fileName = filePath.split('/').pop()
        if (!fileName) continue
        try {
          const fileHandle = await resourcesHandle.getFileHandle(fileName)
          const file = await fileHandle.getFile()
          resources[id] = URL.createObjectURL(file)
        } catch {
          // 忽略图片加载失败
        }
      }
    }
    const meta = await parseExtractedFolder(dirHandle)
    const slideData = await loadSlidesFromFolder(dirHandle)
    await prepareStaticPlans(slideData)
    return { meta, slideData, resources }
  } catch (error) {
    revokeObjectUrls(resources)
    throw error
  }
}
