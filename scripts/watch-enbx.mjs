import { watch } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'

const rootDir = process.cwd()
const testCasesDir = path.join(rootDir, 'test_cases')
const debounceTimers = new Map()
const fileSignatures = new Map()

/**
 * 延时函数，用于重试时等待文件写入完成
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * 判断文件名是否为 enbx
 */
function isEnbxFile(fileName) {
  return path.extname(fileName).toLowerCase() === '.enbx'
}

/**
 * 防止 ZIP 内路径穿越到目标目录外
 */
function resolveSafeOutputPath(baseDir, relativePath) {
  const outputPath = path.resolve(baseDir, relativePath)
  if (outputPath === baseDir || outputPath.startsWith(`${baseDir}${path.sep}`)) {
    return outputPath
  }

  return null
}

/**
 * 读取文件并在必要时重试，避免监听到变更时文件尚未写完
 */
async function readFileWithRetry(filePath, retries = 8, delayMs = 250) {
  let lastError = null

  for (let i = 0; i < retries; i += 1) {
    try {
      return await fs.readFile(filePath)
    } catch (error) {
      lastError = error
      await sleep(delayMs)
    }
  }

  throw lastError
}

/**
 * 将 enbx 解压到 test_cases/<文件名>/ 目录
 */
async function extractEnbxFile(filePath) {
  const fileName = path.basename(filePath)
  const outputDirName = path.basename(fileName, path.extname(fileName))
  const outputDir = path.join(testCasesDir, outputDirName)

  const fileBuffer = await readFileWithRetry(filePath)
  const zip = await JSZip.loadAsync(fileBuffer)

  await fs.rm(outputDir, { recursive: true, force: true })
  await fs.mkdir(outputDir, { recursive: true })

  const entries = Object.values(zip.files)
  for (const entry of entries) {
    const safeOutputPath = resolveSafeOutputPath(outputDir, entry.name)
    if (!safeOutputPath) {
      console.warn(`[ENBX监听] 跳过可疑路径: ${entry.name}`)
      continue
    }

    if (entry.dir) {
      await fs.mkdir(safeOutputPath, { recursive: true })
      continue
    }

    const content = await entry.async('nodebuffer')
    await fs.mkdir(path.dirname(safeOutputPath), { recursive: true })
    await fs.writeFile(safeOutputPath, content)
  }

  console.log(`[ENBX监听] 已解压: ${fileName} -> ${outputDirName}`)
}

/**
 * 检查文件签名是否变化，变化时执行覆盖解压
 */
async function handleFileChange(filePath) {
  try {
    const stats = await fs.stat(filePath)
    const signature = `${stats.size}-${stats.mtimeMs}`
    if (fileSignatures.get(filePath) === signature) {
      return
    }

    fileSignatures.set(filePath, signature)
    await extractEnbxFile(filePath)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      fileSignatures.delete(filePath)
      return
    }
    console.error(`[ENBX监听] 处理失败: ${filePath}`, error)
  }
}

/**
 * 去抖触发，避免同一次写入触发多次解压
 */
function scheduleFileChange(filePath) {
  const oldTimer = debounceTimers.get(filePath)
  if (oldTimer) {
    clearTimeout(oldTimer)
  }

  const timer = setTimeout(async () => {
    debounceTimers.delete(filePath)
    await handleFileChange(filePath)
  }, 500)

  debounceTimers.set(filePath, timer)
}

/**
 * 启动时处理当前已有 enbx 文件
 */
async function processExistingEnbxFiles() {
  const entries = await fs.readdir(testCasesDir)
  const enbxFiles = entries.filter(isEnbxFile)
  for (const fileName of enbxFiles) {
    const filePath = path.join(testCasesDir, fileName)
    await handleFileChange(filePath)
  }
}

async function main() {
  const runOnce = process.argv.includes('--once')

  await fs.mkdir(testCasesDir, { recursive: true })
  await processExistingEnbxFiles()

  if (runOnce) {
    return
  }

  watch(testCasesDir, (_, fileNameBuffer) => {
    if (!fileNameBuffer) {
      return
    }

    const fileName = fileNameBuffer.toString()
    if (!isEnbxFile(fileName)) {
      return
    }

    const filePath = path.join(testCasesDir, fileName)
    scheduleFileChange(filePath)
  })

  console.log(`[ENBX监听] 正在监听目录: ${testCasesDir}`)
}

main().catch((error) => {
  console.error('[ENBX监听] 程序异常退出', error)
  process.exit(1)
})
