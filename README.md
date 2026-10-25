# 希沃白板课件查看器（WebEN）

一个基于 React + TypeScript + Vite 的 第三方 ENBX 课件查看器，用于在浏览器中解析和查看希沃白板课件内容。

## 目录结构

- `src/enbx/`：ENBX 元数据、页面、元素、动画和 XML 解析。
- `src/courseware/`：本地/云课件加载、保存与导出。
- `src/components/`、`src/hooks/`：界面组件和应用级 hooks。
- `src/rendering/`、`src/text/`：渲染缓存、形状描边、字体和文本规则。
- `src/platform/`、`src/viewer/`：宿主桥接、运行时、播放器设置与编辑辅助。
- `src/types/`、`src/styles/`：类型和样式；根级 `types.ts`、`styles.ts` 为公共导出。
- `electron/`、`scripts/`、`tests/`：桌面入口、工具和测试。
- `docs/`：设计与优化记录；`enbx_docs/`：ENBX 兼容性规范。

`dist/`、`dist-electron/`、`release/`、`public/ruffle/` 是生成目录；`node_modules/`、本机 `.env`、测试课件和诊断 `artifacts/` 也不提交。`pnpm-lock.yaml` 和 `tests/fixtures/` 是需要提交的依赖锁文件与测试数据。文件是否已提交以 `git ls-files` 为准，本地目录存在不代表已进入 Git。

## 环境要求

- Node.js 18+
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

## 开发提示

> 提示：本项目绝大部分代码采用 **Vibe Coding** 方式完成。

## License

AGPL-3.0-only
