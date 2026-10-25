# 希沃白板课件查看器（WebEN）

一个基于 React + TypeScript + Vite 的 第三方 ENBX 课件查看器，用于在浏览器中解析和查看希沃白板课件内容。

## 目录结构

- `src/enbx/`：ENBX 元数据、页面、元素、动画和 XML 解析。
- `src/courseware/`：本地/云课件加载、保存与导出。
- `src/components/`、`src/hooks/`：界面组件和应用级 hooks。
- `src/rendering/`、`src/text/`：渲染缓存、形状描边、字体和文本规则。
- `src/platform/`、`src/viewer/`：宿主桥接、运行时、播放器设置与编辑辅助。
- `src/documents/`：宿主专用 PDF 阅读、布局、批注和双指手势，独立于 ENBX 播放器挂载。
- `src/types/`、`src/styles/`：类型和样式；根级 `types.ts`、`styles.ts` 为公共导出。
- `electron/`、`scripts/`、`tests/`：桌面入口、工具和测试。
- `docs/`：设计与优化记录；`enbx_docs/`：ENBX 兼容性规范。

`dist/`、`dist-electron/`、`release/`、`public/ruffle/`、`public/pdfjs/` 是生成目录；`node_modules/`、本机 `.env`、测试课件和诊断 `artifacts/` 也不提交。`pnpm-lock.yaml` 和 `tests/fixtures/` 是需要提交的依赖锁文件与测试数据。文件是否已提交以 `git ls-files` 为准，本地目录存在不代表已进入 Git。

## 环境要求

- Node.js 22.13+ 或 24+（PDF.js 6 依赖要求）
- pnpm 8+

## 快速开始

```bash
pnpm install
```

## 开发运行

启动本地开发服务器（默认端口 `5173`）：

```bash
pnpm dev
```

启动后在浏览器访问终端输出中的本地地址（通常是 `http://localhost:5173`）。

## 生产构建

```bash
pnpm build
```

## 本地预览构建结果

```bash
pnpm preview
```

## Electron 桌面版

开发模式（连接 Vite 开发服务器）：

```bash
pnpm dev:desktop
```

Electron 主进程与 preload 使用 TypeScript，开发时会自动监听编译到 `dist-electron/`。
`dev:desktop` 固定使用 `5173` 端口（`--strictPort`），若端口被占用会直接报错，请先释放端口后重试。

打包静态桌面版本：

```bash
# 当前平台
pnpm build:desktop

# 指定平台
pnpm build:desktop:win
pnpm build:desktop:mac
pnpm build:desktop:linux
```

构建产物输出目录：`release/`

## 技术栈

- React 18
- TypeScript 5（严格模式）
- Vite 5

## 项目说明

- 本项目主要用于 ENBX 文件内容解析与可视化展示
- 播放模式提供画笔、压感、荧光笔、面积擦、整笔擦及按页撤销/重做。选择工具支持套索同时选中课件和墨迹，统一移动、缩放、旋转与置顶。选中的元素或组合支持双指捏合缩放、旋转和平移，逐帧平滑跟随大屏触摸；旋转接近页面绝对 0°、90°、180°、270° 时自动吸附，6° 内进入、偏离 10° 才脱离，避免边界抖动。抬起一指后可继续单指拖动，整次手势可一次撤销。
- 批注属于当前放映会话，关闭或重载后清除，不写入 ENBX 文件。宿主接入与协议见 [Web 批注](docs/web-annotation.md)。

## 宿主文档视图（PDF / Word）

CE-ENBX 可通过桥接打开独立的 PDF 视图，支持单 / 双页、连续 / 分页、适合宽度 / 整页、CE 笔刷 / 橡皮 / 历史、双指滚动 / 缩放与惯性。PDF 与墨迹使用同一页面坐标和滚动节点，支持页面虚拟化与延迟高清重绘。Word 转换、文件授权与批注持久化由宿主插件负责，不依赖 Electron，也不在普通浏览器中直接调用 Office。

`pnpm dev` / `pnpm build` 会复制 PDF.js 离线 CMap、字体、WASM 与许可证；Worker 经 Vite 打包。批注与原 PDF 分离，重开可恢复，激光不持久化。协议、模块与首版限制见 [文档视图](docs/document-viewer.md)。

## 开发提示

> 提示：本项目绝大部分代码采用 **Vibe Coding** 方式完成。

## License

AGPL-3.0-only
