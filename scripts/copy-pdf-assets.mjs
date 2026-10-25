import { cp, mkdir } from 'node:fs/promises'
import path from 'node:path'

const source = path.resolve('node_modules/pdfjs-dist')
const target = path.resolve('public/pdfjs')
await mkdir(target, { recursive: true })
for (const name of ['cmaps', 'standard_fonts', 'wasm', 'LICENSE']) {
  await cp(path.join(source, name), path.join(target, name), { recursive: true })
}
console.log('[PdfAssets] 离线字体、CMap、WASM 和许可证就绪')
