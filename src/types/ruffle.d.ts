/**
 * Ruffle 运行时最小类型声明
 *
 * @ruffle-rs/ruffle 是 wasm-bindgen 产物，不提供 .d.ts；此处只声明 WebEasiNote
 * 实际使用的 API（selfhosted 构建的 window.RufflePlayer + RufflePlayer 元素）。
 */

/** Ruffle 全局配置，必须在创建任何 player 之前写入 */
export interface RuffleConfig {
  /** 运行时资源（wasm/chunk）的绝对基准 URL，必须以 / 结尾 */
  publicPath?: string | null
  autoplay?: 'on' | 'off' | 'auto'
  unmuteOverlay?: 'visible' | 'hidden'
  letterbox?: 'on' | 'off' | 'fullscreen'
  scale?: 'showAll' | 'noBorder' | 'exactFit' | 'noScale'
  quality?: 'low' | 'medium' | 'high' | 'best' | 'high8x8' | 'high8x8linear' | 'high16x16' | 'high16x16linear'
  contextMenu?: 'on' | 'off' | 'rightClickOnly'
  splashScreen?: boolean
  preloader?: boolean
  showSwfDownload?: boolean
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'trace'
  warnOnUnsupportedContent?: boolean
  allowScriptAccess?: boolean
  backgroundColor?: string | null
  [key: string]: unknown
}

/** SWF 加载参数 */
export interface RuffleLoadOptions {
  /** SWF 地址，可为 blob: / http(s): */
  url?: string
  /** 直接给出 SWF 字节（与 url 二选一） */
  data?: ArrayBuffer
  /** SWF 文件名，用于 data 模式下推断相对资源路径 */
  swfFileName?: string
  /** SWF 内相对资源的基准地址；null 表示使用默认值 */
  base?: string | null
  /** FlashVars 等外部参数 */
  parameters?: Record<string, string>
  autoplay?: 'on' | 'off' | 'auto'
  allowScriptAccess?: boolean
  backgroundColor?: string | null
  quality?: RuffleConfig['quality']
  scale?: RuffleConfig['scale']
  letterbox?: RuffleConfig['letterbox']
  unmuteOverlay?: RuffleConfig['unmuteOverlay']
  [key: string]: unknown
}

/** SWF 元数据（Ruffle 无逐帧进度 API，仅提供总量信息） */
export interface RuffleMetadata {
  width: number
  height: number
  frameRate: number
  numFrames: number
  swfVersion: number
  backgroundColor: string | null
  isActionScript3: boolean
  uncompressedSize: number
}

/** RufflePlayer 自定义元素实例 */
export interface RufflePlayer {
  load(options: RuffleLoadOptions): Promise<void>
  play(): Promise<void>
  pause(): void
  destroy(): void
  readonly isPlaying: boolean
  readonly metadata: RuffleMetadata | null
  volume: number
  fullscreenEnabled: boolean
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
}

/** createPlayer() 的返回值：既是 DOM 元素又是播放器 */
export type RufflePlayerElement = RufflePlayer & HTMLElement

/** 单个 Ruffle 版本实例（window.RufflePlayer.newest() 的返回值） */
export interface RuffleInstance {
  createPlayer(): RufflePlayerElement
  readonly isUnsupported?: boolean
}

/** window.RufflePlayer 门面 */
export interface RuffleSource {
  newest(): RuffleInstance
  config: RuffleConfig
  readonly players?: Record<string, RuffleInstance>
}

declare global {
  interface Window {
    RufflePlayer?: RuffleSource
  }
}
