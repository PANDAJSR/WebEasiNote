import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * 复制 Ruffle 运行时资源到 public/ruffle
 *
 * @ruffle-rs/ruffle 仅作为开发依赖，不参与 Vite 打包；运行期由
 * src/ruffle-runtime.ts 按需注入 <script> 加载 ruffle.js。
 *
 * 默认只复制 SIMD 版 wasm（WebView2 / Electron / 现代浏览器均支持 SIMD），
 * 需要兼容非 SIMD 环境时设置 RUFFLE_INCLUDE_MVP=1。
 * wasm 文件名带内容哈希，由 ruffle.js 内部决定，因此从 ruffle.js 中解析。
 */
const rootDir = process.cwd()
const sourceDir = path.join(rootDir, 'node_modules', '@ruffle-rs', 'ruffle')
const targetDir = path.join(rootDir, 'public', 'ruffle')
const includeMvp = process.env.RUFFLE_INCLUDE_MVP === '1'

/**
 * 从 ruffle.js 中解析 wasm 资源文件名
 */
async function resolveWasmFiles(ruffleSource) {
  const names = new Set()
  for (const match of ruffleSource.matchAll(/["']\.\/([\w.-]+\.wasm)["']/g)) {
    const fileName = match[1]
    if (!includeMvp && /mvp/i.test(fileName)) continue
    names.add(fileName)
  }
  return Array.from(names)
}

/**
 * 大小一致视为已复制，避免每次冷启动重复拷贝 14MB 文件
 */
async function copyIfChanged(sourcePath, targetPath) {
  try {
    const [sourceStat, targetStat] = await Promise.all([fs.stat(sourcePath), fs.stat(targetPath)])
    if (sourceStat.size === targetStat.size) return false
  } catch {
    // 目标不存在时直接复制
  }
  await fs.copyFile(sourcePath, targetPath)
  return true
}

async function main() {
  try {
    await fs.access(sourceDir)
  } catch {
    console.warn('[RuffleAssets] 未安装 @ruffle-rs/ruffle，跳过资源复制')
    return
  }
  await fs.mkdir(targetDir, { recursive: true })
  const ruffleSource = await fs.readFile(path.join(sourceDir, 'ruffle.js'), 'utf8')
  const files = ['ruffle.js', 'LICENSE_MIT', 'LICENSE_APACHE', ...await resolveWasmFiles(ruffleSource)]
  let copied = 0
  for (const fileName of files) {
    try {
      const changed = await copyIfChanged(path.join(sourceDir, fileName), path.join(targetDir, fileName))
      if (changed) copied++
    } catch (error) {
      console.warn(`[RuffleAssets] 复制 ${fileName} 失败:`, error.message)
    }
  }
  console.log(`[RuffleAssets] 运行时资源就绪（${copied} 个文件更新，${files.length} 个文件）`)
  if (!includeMvp) console.log('[RuffleAssets] 仅包含 SIMD 版 wasm，非 SIMD 环境请设 RUFFLE_INCLUDE_MVP=1')
}

await main()
