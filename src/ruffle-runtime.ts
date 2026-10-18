import type {
  RuffleConfig,
  RuffleInstance,
  RufflePlayer,
  RufflePlayerElement,
  RuffleSource
} from './types/ruffle'

/** Ruffle 运行时资源目录（相对当前文档），dev / ENBX WebView2 / Electron 三端通用 */
const RUFFLE_DIR = 'ruffle/'

let loadPromise: Promise<RuffleSource> | null = null

/**
 * 解析 Ruffle 资源目录的绝对 URL
 *
 * Ruffle 内部用 `new URL(相对资源名, publicPath)` 加载 wasm，publicPath 必须是绝对
 * URL 且以 / 结尾，否则会抛 invalid base URL。
 */
function resolveRuffleBase(): string {
  return new URL(RUFFLE_DIR, document.baseURI).href
}

/** 全局配置：必须在创建任何 player 之前写入 */
function buildConfig(): RuffleConfig {
  return {
    publicPath: resolveRuffleBase(),
    autoplay: 'on',
    // 打开弹窗本身就是用户手势，无需 Ruffle 的解除静音遮罩
    unmuteOverlay: 'hidden',
    // 舞台比例与容器不一致时留黑边，绝不裁切内容
    letterbox: 'on',
    scale: 'showAll',
    contextMenu: 'rightClickOnly',
    splashScreen: false,
    preloader: false,
    showSwfDownload: false,
    logLevel: 'error',
    warnOnUnsupportedContent: false
  }
}

/** 注入 ruffle.js 并等待 window.RufflePlayer 就绪 */
function injectRuffleScript(): Promise<RuffleSource> {
  const existed = window.RufflePlayer
  if (existed?.newest) return Promise.resolve(existed)
  // 复用已注入的标签，避免加载失败重试时重复插入
  const existing = document.querySelector<HTMLScriptElement>('script[data-ruffle-runtime="true"]')
  if (existing) {
    return new Promise<RuffleSource>((resolve, reject) => {
      existing.addEventListener('load', () => {
        const source = window.RufflePlayer
        if (source?.newest) resolve(source)
        else reject(new Error('Ruffle 加载完成但未注册 window.RufflePlayer'))
      }, { once: true })
      existing.addEventListener('error', () => reject(new Error('Ruffle 脚本加载失败')), { once: true })
    })
  }
  return new Promise<RuffleSource>((resolve, reject) => {
    const script = document.createElement('script')
    script.dataset.ruffleRuntime = 'true'
    script.src = new URL(`${RUFFLE_DIR}ruffle.js`, document.baseURI).href
    script.async = true
    script.onload = () => {
      const source = window.RufflePlayer
      if (!source?.newest) {
        reject(new Error('Ruffle 加载完成但未注册 window.RufflePlayer'))
        return
      }
      resolve(source)
    }
    script.onerror = () => reject(new Error('Ruffle 脚本加载失败'))
    document.head.appendChild(script)
  })
}

/**
 * 按需加载 Ruffle 运行时（进程内只加载一次）
 */
export function loadRuffleRuntime(): Promise<RuffleSource> {
  if (!loadPromise) {
    loadPromise = injectRuffleScript().catch(error => {
      // 失败不缓存，允许下次重试
      loadPromise = null
      throw error
    })
  }
  return loadPromise
}

function newestInstance(source: RuffleSource): RuffleInstance {
  const instance = source.newest()
  if (!instance) throw new Error('Ruffle 运行时不可用（浏览器可能不支持 WebAssembly）')
  return instance
}

/**
 * 在指定容器内创建 Ruffle 播放器
 */
export async function createRufflePlayer(container: HTMLElement): Promise<RufflePlayer> {
  const source = await loadRuffleRuntime()
  const instance = newestInstance(source)
  source.config = buildConfig()
  const player = instance.createPlayer() as RufflePlayerElement
  player.style.width = '100%'
  player.style.height = '100%'
  player.style.display = 'block'
  container.appendChild(player)
  return player
}

/**
 * 加载 SWF（blob: 地址由 courseware-loader 统一创建与回收，此处不得 revoke）
 */
export async function loadSwf(player: RufflePlayer, url: string): Promise<void> {
  await player.load({
    url,
    // SWF 无外部相对资源可加载，显式声明避免 Ruffle 猜测 blob: 的目录
    base: null,
    autoplay: 'on',
    backgroundColor: '#000000'
  })
}

/**
 * 销毁播放器（Ruffle 的 destroy 会自行从 DOM 移除）
 */
export function destroyRufflePlayer(player: RufflePlayer | null): void {
  if (!player) return
  try {
    player.pause()
  } catch {
    // 播放器可能已销毁
  }
  try {
    player.destroy()
  } catch {
    // 播放器可能已销毁
  }
}
