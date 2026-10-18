# Flash 元素支持（Ruffle）研究与实现计划

> 目标：WebEasiNote 支持希沃白板 ENBX 中的 `<Flash>` 元素。渲染层复刻官方「红色圆形 Flash 图标」，
> 点击后**在页面内弹出弹窗**用 [Ruffle](https://ruffle.rs/) 播放 SWF（官方是独立窗口，此处为有意偏离）。
>
> 研究素材：本机 `C:\Program Files (x86)\Seewo\EasiNote5\EasiNote5_5.2.4.10148` 反编译结果
> （`Cvte.Paint.Shell.dll` 的 `Cvte.Paint.FlashPlayer` 命名空间）+ 真实课件取证
> `flash英语_c5308831-473b-442b-8e5d-755e3ff3ad8b_v47.enbx`。
> 反编译产物保存在 `D:\Code\EasiNote-Resarch\decompiled_flash\`。

## 1. 结论摘要

- **可行**：Flash 元素在 ENBX 里是普通顶层元素，资源走标准 `id://` → `Reference.xml` → `Resources/*.swf` 链路，
  `courseware-loader.ts` 已经把所有资源统一转成 `blob:` URL，**加载层零改动**。
- **契约明确**：`<Flash>` 只有 4 个专属字段（`Source`/`FlashName`/`FlashWidth`/`FlashHeight`），
  其余字段与通用元素一致，可直接复用 `applyOffset` 等既有逻辑。
- **Ruffle 能覆盖播放**：AVM1/AVM2 SWF 均可播放；但 **0.7.1 与 0.8 nightly 都没有 `currentFrame`/`totalFrames`/
  `gotoFrame`**，官方的帧进度条、点击跳帧、`RePlay()` 末帧重载无法复刻 → 控制条降级为「播放/暂停 + 重播 + 静音 + 最大化」。
- **主要成本在打包体积**：Ruffle 运行时含两个 ~14MB wasm（SIMD / MVP 各一）。ICC-CE-ENBX 会把 `dist/**`
  内嵌进插件 DLL，插件体积会从 ~1MB 涨到 15MB（仅 SIMD）或 30MB（全量）。这是本计划唯一需要拍板的取舍。

## 2. 逆向结论（官方行为模型）

### 2.1 元素模型

```
Cvte.Paint.FlashPlayer.Flash : MultimediaElement, ISavable<FlashSaveInfo>
```

- 契约标签 `<Flash>`，`[SaveInfoContract("Flash", Description = "Flash")]`。
- `FlashSaveInfo` 成员：`Source`（Uri，`IsRequired = true`）、`FlashName`（默认 `""`）、
  `FlashWidth`（默认 `99`）、`FlashHeight`（默认 `99`）。
- **尺寸语义（关键）**：元素自身的 `Width`/`Height` 是那个 64×64 图标的尺寸；
  `FlashWidth`/`FlashHeight` 是 SWF 舞台原生尺寸。填充缩放在 `FlashContainerGrid_OnSizeChanged` 里做
  `new Rect(0,0,FlashSize).FillInto(outerRect)`，即**等比 letterbox**，不拉伸变形。
- 变换约束：`[Transform(PermittedTransforms.FixedRatioScaleOnly)]` → 只允许等比缩放，不允许单轴拉伸。
- 点击链路：图标内的 `InteractiveButton.Click` → `PlayButtonClicked` → `ShowFlashPlayer()`：
  `PostEvent("Flash_Play")` → 无播放器则新建窗口、有则 `RePlay()`。窗口 `Closing` 时引用置空。
- 埋点：`Em_`（电子白板）/`Dm_`（交互白板）前缀 + `Flash_Play`、`FlashWindow_Play/Pause/Max/Normal/
  DragProgressBar/ClickProgressBar`。WebEasiNote 无埋点体系，本期不复刻。

### 2.2 图标 UI（官方 `FlashElementContent.xaml`，逐值复刻）

- 外层 64×64 `Grid` → `Viewbox`（随元素尺寸等比缩放）。
- 红圆：路径 `M0,32 A32,32 0 0 1 64,32A32,32 0 0 1 0,32`，`Fill=#E34A4A`，`Stroke=#FFFFFFFF`，
  `StrokeThickness=2`，`DropShadowEffect BlurRadius=8 ShadowDepth=0 Color=#4C000000 Opacity=0.3`，不参与命中测试。
- 图形区：居中 32×32，两个白色 `Opacity=0.8` 几何图形，**默认显示 `Image.Flash`（字母 f），
  鼠标进入切 `Image.Play`（三角）**，移出切回：
  - `Image.Flash`：`Margin="-3 0 0 0"`，`Stretch=None`（自然尺寸 25×30）。
  - `Image.Play`：`Margin="5 0 0 0"`，自然尺寸 ≈17.3×24.6，`FillRule=EvenOdd`。
- 命中层：整圆透明 `Ellipse` 模板的 `InteractiveButton`，`Cursor=Hand`。
- 换算成 SVG（`viewBox="0 0 64 64"`）时两段几何的平移量
  （32×32 字形区在 64×64 内的居中量 16 + 区内居中偏移 + 官方 Margin − 字形包围盒原点）：
  `f`（原生 25×30，包围盒起点 2.333,1.333）→ `translate(14.167 15.667)`；
  `play`（原生 17.028×23.855，包围盒起点 5.201,0.284）→ `translate(23.285 19.789)`。
  校验：`f` 占位 x[16.5,41.5] y[17,47]，`play` 占位 x[28.5,45.5] y[20.07,43.93]，垂直中心均为 32。
- 2px 描边与阴影会超出 64×64 视口，SVG 需 `overflow: visible`（官方 `Viewbox` 以含描边的边界为准）。

### 2.3 官方播放器窗口（`FlashPlayerWindow`，仅作行为参照）

独立 WPF 窗口 + `WindowsFormsHost` + ActiveX `AxShockwaveFlash`：`Movie = Source`；150ms `DispatcherTimer`
轮询 `CurrentFrame()`/`TotalFrames` 驱动进度条；进度条拖动 → `GotoFrame`；距末帧 ≤2 时 `ResetFlash()` 重载
`Movie`；窗口尺寸 = 半个显示器宽、高按 `FlashHeight/FlashWidth` 计算；快捷键 `6` 切尺寸、`13`(Enter) 关闭/还原、
`18`(Alt) 播放暂停。这些行为中**只有播放/暂停、等比尺寸、关闭可复刻**。

### 2.4 真实课件取证

| 项目 | 实测值 |
| --- | --- |
| `<Flash>` 数量 | 19 个，分布在 5 页 |
| 元素尺寸 | 64×64 / 81×81 / 63.688×63.688（同一元素宽高必然相等） |
| `FlashWidth`×`FlashHeight` | 800×600、320×240、700×492 |
| `FlashName` | 原始文件名（含中文与空格，如 `Main scene.swf`、`Let's write..swf`） |
| SWF 资源 | 18 个，合计 22MB，最大 2.5MB；AVM1(v6) 与 AVM2(v9~11) 混合 |
| 其它子节点 | `SaveInfoMetadata`（`SupportsFallback`/`ImportanceLevel`），无 `Animations` 节点 |

真实节点（`Slides/Slide_1.xml`）：

```xml
<Flash>
  <Source>id://c8449b3a07dc787f038f631a967d8dcf</Source>
  <FlashName>Main scene.swf</FlashName>
  <FlashWidth>800</FlashWidth>
  <FlashHeight>600</FlashHeight>
  <Id>9fe7cd57-60a8-469d-a840-205bf787dace</Id>
  <X>106.384</X><Y>218.324</Y><Width>64</Width><Height>64</Height>
  <Rotation>0</Rotation>
  <IsLocked>False</IsLocked><CanClone>False</CanClone><HasMask>False</HasMask>
  <RotateOrigin>0.5,0.5</RotateOrigin>
  <SaveInfoMetadata>
    <SupportsFallback>True</SupportsFallback>
    <ImportanceLevel>Important</ImportanceLevel>
  </SaveInfoMetadata>
</Flash>
```

## 3. 与官方的差异（有意偏离 / 客观不可复刻）

| 行为 | 官方 | 本实现 | 说明 |
| --- | --- | --- | --- |
| 播放容器 | 独立顶层窗口 | 页内 antd `Modal` | 用户明确要求 |
| 帧进度条 / 跳帧 | `CurrentFrame`+`GotoFrame` | **不做** | Ruffle 无帧 API |
| 末帧重播 | `RePlay()` 重载 `Movie` | 控制条「重播」按钮 | 语义等价，改为显式操作 |
| 快捷键 | 6 / Enter / Alt | `Esc` 关闭（+ 可选 `Space` 播放暂停） | 网络语义 |
| 埋点 | `PostEvent` | 无 | 无埋点体系 |
| 跨页播放 | 无（窗口随元素/页面关闭） | 切换页面自动关闭并销毁播放器 | 与官方一致 |
| 蒙版 `HasMask` | 生效 | 弹窗不受蒙版影响 | 极少见，暂记为限制 |
| SWF 相对外部资源加载 | 本地路径可用 | 不可用（`blob:` 无目录） | 单文件 SWF 无影响 |

## 4. Ruffle 集成方案

### 4.1 版本与运行时资源

| 版本 | 文件 | 体积 |
| --- | --- | --- |
| `0.8.0-nightly.2026.10.18`（推荐） | `ruffle.js` | 682KB |
| | `ruffle_web_bg.<hash>.wasm`（SIMD） | 14.16MB |
| | `ruffle_web-wasm_mvp_bg.<hash>.wasm`（MVP/非 SIMD 回退） | 14.21MB |
| `0.7.1`（稳定） | `ruffle.js` + 2 个 `core.ruffle.*.js` + 2 个 wasm | ≈29MB |

推荐 nightly 并**固定版本号**（新版对 Flash CS6 时代教育类 SWF 的 AVM1/AVM2 兼容性明显更好）。
nightly 把 core 逻辑合进了 `ruffle.js`，只需拷 3 个文件；wasm 文件名带 hash，由 `ruffle.js` 内部决定。

### 4.2 资源落地

- `@ruffle-rs/ruffle` 只作为 **devDependency**，不参与打包（避免 Vite 处理 wasm-bindgen 产物）。
- 新增 `scripts/copy-ruffle-assets.mjs`：把 `node_modules/@ruffle-rs/ruffle` 下的 `ruffle.js`、
  两个 `*.wasm`、`LICENSE_MIT`、`LICENSE_APACHE` 拷到 `public/ruffle/`；已存在则跳过（幂等）。
- `package.json` 显式串联（不依赖 pre/post 钩子）：
  `"dev": "node scripts/copy-ruffle-assets.mjs && vite"`、`"build": "node scripts/copy-ruffle-assets.mjs && tsc && vite build"`。
- `.gitignore` 增加 `/public/ruffle/`（29MB 二进制不入库；Vite 的 `public/` 会自动输出到 `dist/ruffle/`）。
- **`publicPath` 必须传绝对 URL**：Ruffle 用 `new URL(相对路径, publicPath)` 解析 wasm，传 `'/WebEasiNote/ruffle/'`
  会抛 `invalid base URL`。做法：

  ```ts
  window.RufflePlayer.config = { publicPath: new URL('ruffle/', document.baseURI).href, ... }
  ```

  这样 dev (`http://localhost:5173/`)、ENBX WebView2 (`https://enbx.local/WebEasiNote/index.html` → `/WebEasiNote/ruffle/`)、
  Electron `file://` 三种来源都正确。

### 4.3 运行时加载与播放

- 按需加载：首次打开弹窗时向 `document.head` 注入 `<script src="<base>ruffle/ruffle.js">`（带缓存 Promise），
  不把 682KB 塞进主包。脚本加载完成后立刻写一次 `window.RufflePlayer.config`（Ruffle 要求在任何 player 创建前设置）。
- 全局配置建议：

  ```ts
  { publicPath: new URL('ruffle/', document.baseURI).href,
    autoplay: 'on', unmuteOverlay: 'hidden', letterbox: 'on', scale: 'showAll',
    contextMenu: 'rightClickOnly', splashScreen: false, preloader: false,
    showSwfDownload: false, logLevel: 'error', warnOnUnsupportedContent: false }
  ```

- 播放：`player.load({ url: blobUrl, base: null, backgroundColor: '#000000', autoplay: 'on' })`
  （`base: null` 显式声明 SWF 无相对基址，避免 Ruffle 对 `blob:` 目录推断告警）。
  备选 `{ data: ArrayBuffer, swfFileName: FlashName }`，便于错误信息显示原始文件名。
- 生命周期：关闭弹窗或切页 → `player.pause()` + `player.destroy()`；blob URL 归 `courseware-loader` 统一回收，播放器不得 revoke。
- 控制：`player.play()` / `player.pause()` / `player.isPlaying` / `player.volume`；「重播」优先再次 `load()`，
  若实测有状态残留则退化为 destroy + 重建。
- 类型：Ruffle 不带 `.d.ts`，且项目 TS 严格，新增 `src/types/ruffle.d.ts` 声明
  `RufflePlayer`（`newest()`、`createPlayer()`、`load/play/pause/destroy`、`metadata`、`isPlaying`、`volume`）
  与 `window.RufflePlayer`。

### 4.4 弹窗与尺寸

- antd `Modal`，`width` 自适应，`centered`，`footer={null}`，`destroyOnHidden`，`maskClosable`，自定标题为 `FlashName`。
- 播放区按 `FlashWidth:FlashHeight` 的 `aspect-ratio` 撑开，`width: min(90vw, 1280px)` + `max-height: 70vh`，
  由 CSS 反推宽度（与原官方 `FillInto` 的等比填充同效）；Ruffle 侧再叠一层 `letterbox: 'on'` 兜底。
- 打开动画期间容器尺寸不稳定 → 在 `afterOpenChange(true)` 后再挂载 Ruffle（此前显示加载态）。
- 控制条：播放/暂停、重播、静音、最大化（Fullscreen API）、关闭；`Esc` 关闭。
- 资源缺失（`resourceMap[sourceId]` 为空）：不弹窗，就地渲染浅色提示框「Flash 资源未加载」（与 `VideoRenderer` 一致）。

## 5. 逐文件改动清单

### 5.1 WebEasiNote

| 文件 | 改动 |
| --- | --- |
| `src/types/elements.ts` | 在 `VideoElement` 后新增 `FlashElement`（含 `rawXml?`） |
| `src/types/slide.ts` | `SlideElement` 联合类型加入 `FlashElement`，并 import |
| `src/types.ts`、`src/parser.ts` | 追加 `FlashElement` 类型再导出 |
| `src/flashes.ts` | 新增 `parseFlashElement(node): FlashElement \| null`，`Source` 缺失返回 `null`；`FlashWidth/FlashHeight` 缺省 99 |
| `src/slide-elements-parser.ts` | 新增 `case 'Flash'`（克隆 `case 'Video'`：`collectUnknownParameters` + `applyOffset` + `rawXml`） |
| `src/slide-elements-known-parameters.ts` | 新增 `Flash: new Set(['Id','X','Y','Width','Height','Rotation','IsLocked','CanClone','HasMask','RotateOrigin','SaveInfoMetadata','Source','FlashName','FlashWidth','FlashHeight','Animations'])` |
| `src/components/slide-renderer/ElementRenderer.tsx` | 新增 `case 'flash'` → `<FlashRenderer .../>` |
| `src/components/FlashRenderer.tsx` | 新增：红圈图标（SVG 复刻 2.2 节几何/配色/悬停切换）+ 弹窗状态 |
| `src/components/FlashPlayerModal.tsx` | 新增：Modal + 控制条 + Ruffle 挂载/销毁 |
| `src/ruffle-runtime.ts` | 新增：脚本按需加载、全局配置、`createRufflePlayer`/`destroyRufflePlayer` |
| `src/types/ruffle.d.ts` | 新增：Ruffle 全局 API 声明 |
| `scripts/copy-ruffle-assets.mjs` | 新增：运行时资源复制（幂等） |
| `package.json` | `-D @ruffle-rs/ruffle@<pin>`；`dev`/`build` 前置复制脚本 |
| `.gitignore` | 追加 `/public/ruffle/` |
| `tests/flash-element.test.ts` | 新增解析单测 |

**不改**：`courseware-loader.ts`（已为所有资源建 blob URL）、`SlideViewerLayer.tsx`（Flash 不需要跨页保活）、
`SlideRenderer.tsx`（元素包裹层已就绪）、`vite.config.ts`（`public/` 默认生效）。

### 5.2 ICC-CE-ENBX

| 文件 | 改动 |
| --- | --- |
| `EnbxWebViewLayer.cs` | `GetContentType` 增加 `".wasm" => "application/wasm"` |
| `ICC.CE.ENBX.csproj` | 无需改动（`dist/**` 已递归内嵌） |

`.wasm` 的 MIME **不是硬阻塞**：实测 Ruffle 在 `instantiateStreaming` 因 MIME 失败时会回退
`WebAssembly.instantiate(arrayBuffer)`，仅打一条 warn。加上它是为了走流式编译、消掉噪音日志。

### 5.3 文档同步（与代码同一次提交）

- `enbx_docs/04-元素规范-文本图形多媒体.md`：新增「Flash 元素」小节——字段表（含默认值 99）、
  `Width/Height` 与 `FlashWidth/FlashHeight` 的语义差异、图标规格、Ruffle 映射与限制。
- `enbx_docs/06-兼容性与未支持清单.md`：Flash 移出未支持清单，注明「播放支持、帧进度/跳帧不支持」。

## 6. 渲染与交互细节

- `FlashRenderer` 尺寸取 `element.width/height × scale`，内部 SVG `viewBox="0 0 64 64"` +
  `width/height: 100%`，等价官方 `Viewbox` 行为（元素被拉大时图标等比放大）。
- 点击：图标自身的 `onClick` 必须 `event.stopPropagation()`，否则会冒泡到 `SlideRenderer` 包裹层的
  `handleEditElementClick`（播放模式会误触发动画、编辑模式会误选中）。
- 播放模式：单击打开弹窗（对齐官方 `ShowFlashPlayer`）。
- 编辑模式：单击保持选中/拖拽，双击打开预览。
- 元素被动画隐藏（`elementRenderStates[id] === false`）或页面切换（`slideIndex !== currentIndex`）时关闭弹窗。
- 弹窗用 antd Portal 挂到 `body`，天然脱离 `transform: scale()` 的幻灯片坐标系，无需换算缩放。

## 7. 测试计划

- `tests/flash-element.test.ts`（node:test + `assert/strict`）：
  1. 真实节点全字段解析（`sourceId` 去掉 `id://`、`flashName`、`flashWidth/Height`、旋转/锁定等）；
  2. `FlashWidth/FlashHeight` 缺省 → 99；`Source` 缺失 → `null`；
  3. 真实节点的子标签不产生 `unknown-parameter` issue（防回归）。
- 手工验证矩阵：`flash英语…v47.enbx`（19 个 Flash）逐页点开；AVM1（v6）与 AVM2（v9~11）各抽 1 个；
  资源缺失用例；Web 与 Electron（ICC-CE-ENBX 内嵌）双端各跑一遍。

## 8. 分阶段实施

1. **P1 解析 + 图标**：类型/解析/known-parameters/ElementRenderer + 红圈图标（点击先只 `console.log`）。
2. **P2 播放**：Ruffle 资源复制脚本 + `ruffle-runtime.ts` + `FlashPlayerModal`（播放/暂停/重播/静音/关闭）。
3. **P3 打磨**：最大化、`Esc`、切页销毁、加载态、缺失资源提示。
4. **P4 打包**：ICC-CE-ENBX `.wasm` MIME + 体积裁剪方案 + `enbx_docs` 同步 + 单测。

## 9. 待确认决策

1. **Ruffle 版本**：推荐 `0.8.0-nightly.2026.10.18` 固定版本（兼容性优先）；保守可选 `0.7.1`。
2. **wasm 打包策略**（影响插件体积）：
   - A. 全量（SIMD + MVP）≈29MB，全浏览器安全；
   - B. **仅 SIMD ≈14MB（推荐）**——WebView2（Chromium 100+）与 Electron 41 必然支持 SIMD，
     非 SIMD 分支只服务远古浏览器；
   - C. 仅 SIMD + gzip（4.7MB，实测压缩比）并由 `EnbxWebViewLayer` 对 `.wasm` 附 `Content-Encoding: gzip`，
     插件 DLL 约 +5MB，但需要额外响应头处理，建议放二期。
3. **弹窗形态**：推荐先用 antd `Modal`（居中 + 最大化按钮）；若要更贴近官方「可拖动可缩放浮窗」，放二期。

## 10. 风险与限制

- Ruffle 无帧 API → 进度条永缺；若后续 Ruffle 补齐 `currentFrame`，可增量补上进度条。
- SWF 内相对路径加载的外部资源（`loadMovie`、外部图片/XML）在 `blob:` 下不可用。
- 单页同时打开多个 Flash 会各持一个 wasm 实例（Ruffle 内部共享 wasm 模块，但每个 player 有独立运行时内存），
  教育类 SWF 内存占用偏高；弹窗关闭即销毁可缓解。
- nightly 版本会变化，升级需回归 `flash英语…v47.enbx` 的 18 个 SWF。
