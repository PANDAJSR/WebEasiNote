# Audio 元素播放实现计划

目标：WebEasiNote（WebEN）打开 ENBX 后，可以播放课件中的 `<Audio>` 元素，提供接近希沃官方播放器的图标和控制条，并正确处理切页、循环、裁剪、隐藏和跨页播放。当前阶段只交付计划，不修改播放代码。

## 1. 现状与依据

- `src/slide-elements-parser.ts` 已支持 Video、Flash，但没有 Audio 分支；`ElementRenderer.tsx` 也没有音频渲染分支。
- `src/videos.ts` 和 `VideoRenderer.tsx` 可作为资源映射、坐标、音量及行为字段的接入参考。但现有 Video 只用 `parseFloat` 读取 ClipStart，未处理 ClipEnd，不能直接照搬为完整媒体实现。
- `SlideViewerLayer.tsx` 的 `crossPlaySlide` 和 `shouldKeepAliveForCrossPlay` 只识别 video。新增 AudioRenderer 并不足以实现跨页播放，必须同步扩展保活筛选。
- 既有研究 `D:\Code\EasiNote-Resarch\evidence\inventory\all_element_save_infos.txt` 和 `docs/enbx/ENBX_Elements_Reference.md` 记录了 MediaSaveInfo 的 Source、MediaName、Duration、ClipStart、ClipEnd、Volume、PlayPoints，以及 AudioSaveInfo 的 IsHidden。
- 本次使用 REA 对指定版本 `Main\Cvte.Paint.Shell.dll` 做了静态检查，确认 AudioSaveInfo 继承 MediaSaveInfo，并存在上述属性访问器。成员证据：`ev_652b5555d77c2e51db0d2b832e4dd5f92b7bf24c5a4d71b4217f2844feb8011d`。
- 程序集身份：SHA-256 `481012f25286ac000ac14b15ab1a534476824e921e5b8b034f229ca159c74277`，MVID `98ae2eec-41c3-4275-90a3-b29c80d6b464`，程序集版本 `12.0.27.0`，目标框架 `.NETCoreApp,Version=v6.0`。身份检查父证据：`ev_3e7204305807396511b3ccb1ba230e90e50cdfb963528e9ad1ad3823927789c0`。

这些证据确认了存储模型，不代表已经核实官方播放器的视觉、默认值和运行行为。下文明确标注需要核对的语义，以及 WebEN 的建议实现。

## 2. P0：核对官方实现与真实课件

使用 REA 技能继续分析用户指定目录：

`C:\Program Files (x86)\Seewo\EasiNote5\EasiNote5_5.2.4.10148`

优先追踪 `Main\Cvte.Paint.Shell.dll` 内 AudioSaveInfo 的加载、音频元素内容控件、媒体行为控制器和相关 WPF 资源；仅当调用关系指向 `EasiNote.Audio.dll` 时继续分析该程序集，不凭文件名认定它负责课件播放。

需要形成可复用的证据表：

| 问题 | 核对方式与产出 |
| --- | --- |
| 图标和控制条外观 | 定位内容控件及 XAML/BAML 资源，记录尺寸、颜色、图形、悬停态、播放态、控件展开方式；静态资源无法说明时再观察官方运行界面 |
| 点击语义 | 核对单击是否直接播放、是否展开控制条、播放结束后的图标状态，以及编辑模式行为 |
| 裁剪时间 | 核对 TimeSpan 在实际 XML 中的写法和单位；ClipEnd 是绝对终点还是尾部裁剪长度；缺省值如何表示 |
| 播放行为 | 核对 ElementBehavior 的实际字段、默认值、自动播放时机、循环范围、停止页是否包含该页、回退翻页和重新进入行为 |
| 隐藏音频 | 核对 IsHidden 是否仅在授课时隐藏、是否影响播放、隐藏且自动播放失败时如何处理 |
| 打点 | 核对 PlayPoints 的 XML 结构、单位，以及时间是源媒体绝对时间还是相对裁剪片段时间 |
| 多音频 | 核对同页多个音频、跨页背景音与当前页音频是否互斥 |

选择包含 Audio 的真实 ENBX，保存脱敏后的最小 XML fixture，记录 Source → Reference.xml → Resources 的映射、真实编码和媒体 MIME。人工构造节点只用于边界测试，不能作为官方格式证据。

研究记录建议保存到 `D:\Code\EasiNote-Resarch\topics\audio-player\`，包含目标身份、REA Evidence ID、反编译或资源定位、结论和未决问题；确认的新格式信息同步回本项目 `enbx_docs/`。

P0 完成条件：能确定正常播放、裁剪、循环、跨页和隐藏行为的规则，并有官方样式参照。若个别视觉资源无法提取，采用相似的自绘样式，记录差异即可。

## 3. P1：类型与解析链路

新增 `AudioElement`，按照现有项目结构接入 `types/elements.ts`、`types/slide.ts`、`types.ts` 与 `parser.ts` 的导出。

建议模型包含：

- 通用属性：`type: 'audio'`、id、rawXml、x/y、width/height、rotation。
- 资源属性：sourceId、mediaName。
- 播放属性：volume、clipStart、clipEnd、playPoints、isHidden。
- 行为属性：isAutoPlay、isLoopPlay、isCrossSlidePlay、stopPlayPageNumber。
- Duration 若课件实际保存则可作为提示值；可播放时长最终以浏览器 metadata 为准。

新增 `src/audios.ts` 解析函数，使用直接子节点读取，避免嵌套对象的同名字段被误取。通过 P0 确认的时间序列化规则统一转换成秒；不对未知时间字符串直接 parseFloat。缺省 ClipEnd 用可区分的空值表示，避免与合法的 0 混淆。

数值必须校验有限性、音量范围和尺寸；异常裁剪区间按确认后的规则归一化或显示诊断。Source 缺失不能静默丢失元素，应保留可定位的错误提示。

在 `slide-elements-parser.ts` 加入 Audio 分支，沿用 rawXml、组偏移和组旋转逻辑；同步 `slide-elements-known-parameters.ts`。字段进入已知清单不代表已支持其行为，兼容性文档应分别说明。

## 4. P2：浏览器播放与类似官方的样式

使用 HTMLAudioElement 播放，React 自绘图标及控制条，不新增播放器依赖。正式配色、图标轮廓和展开方式参考 P0 的官方资源；尚未核实前不把臆测的颜色或尺寸当作官方规格。

建议提供的操作：播放/暂停、重播、进度拖动、当前时间/片段总时间、音量/静音；已有 PlayPoints 显示为可点击的进度标记。图标、名称、加载态、播放态和错误态使用统一样式。

- `AudioRenderer.tsx`：课件坐标和变换、图标、控制条开关、资源状态。
- `components/audio-player/AudioControls.tsx`：控制条和打点交互。
- `components/audio-player/useAudioPlayback.ts`：media ref、事件订阅、播放 Promise、裁剪及状态同步。
- `components/audio-player/styles.ts`：集中定义画布内样式；每个文件保持 400 行以内。
- 需要公共时间解析工具时新增 `media-time.ts`，先服务音频，不在本任务中重构全部 Video 逻辑。

控制条随课件画布缩放；若使用浮层，应检查画布边缘裁切、旋转元素及坐标换算。画布内允许原生控件自绘；画布外提示和菜单优先使用 Ant Design。

播放状态以 media 事件为准，处理 loadedmetadata、durationchange、play/pause、timeupdate、ended、waiting、error；不能点击后就假设 play() 成功。自动播放被浏览器拒绝时，提供明确的手动播放入口，不通过静音假装完成有声播放。

裁剪后播放限定在有效区间，循环时回到片段起点，不能仅依靠原生 loop 循环整段资源。拖动和打点跳转同样限定范围。短片段应使用适当的边界检查或调度补充 timeupdate；浏览器方案不承诺采样级裁剪精度。

## 5. P3：切页、动画与编辑生命周期

首选扩展现有幻灯片保活机制，让同一个音频元素实例在跨页时继续存在，不额外创建第二个播放器：

1. `ElementRenderer.tsx` 接入 audio，传递当前页、来源页、编辑模式等上下文。
2. `SlideViewerLayer.tsx` 的跨页筛选和保活条件同时支持 video/audio，保留视频原有行为；确认 React key 和包裹结构不会因页面子集切换而重建音频。
3. 普通音频离开页面时暂停；跨页音频只在已访问且符合停止页条件时继续，未访问页面不能预先自动发声。
4. 到停止页、回退、再次进入来源页的行为按 P0 结论实现。避免过场期间进入页与离开页重复自动播放，以及 StrictMode effect 重跑造成重播。
5. 编辑模式默认不自动播放；单击选中和拖动，提供双击或显式预览入口。进入授课模式是否重播按确认后的规则处理。
6. 音频控制事件不得触发页面翻页、滑动或元素动画。进度拖动需正确处理 pointer capture 和释放。
7. 区分 IsHidden、动画尚未显示、非当前页保活三种状态；隐藏图标不能直接导致播放实例被卸载。自动播放是否等待入场动画显示需要明确规则。
8. 对隐藏音频的播放失败，在画布外提供可恢复的提示/入口，避免用户无法启动或停止背景音。
9. 关闭课件、切换课件、资源被替换和组件卸载时停止并清理事件、调度器；blob URL 沿用加载层的所有权，不由播放器自行 revoke。

如果现有动画或页面结构无法保证实例稳定，再将音频实例提升到 Viewer 级管理；该方案需单独说明播放器与图标如何关联，避免同时维护两套播放源。

## 6. 加载与宿主集成

先检查 `courseware-loader.ts` 的资源 MIME 推断和 URL 回收路径。沿用 resourceMap[sourceId]；只有真实音频样本证明缺少扩展名/MIME 映射时才补充加载层。

Web、Electron、ICC-CE-ENBX 内嵌 WebView2 使用相同前端播放实现。检查插件宿主是否已有自动播放策略及必要的宿主生命周期通知；仅发现实际缺口时修改插件。纯音频播放预期不需要修改 `D:\Code\iccce`。

兼容性按实际编码验证，不能把官方 Windows 解码能力等同于浏览器能力。首批验证 MP3、PCM WAV，补充真实课件中的 AAC/M4A 等编码；不支持的格式显示中文错误与文件名。本期不新增转码服务或大体积 WASM 解码器。

## 7. 验证与验收

实现阶段按 package.json 的实际测试命令运行检查，并完成 `pnpm build`。本次仅新增计划文档，无需运行应用构建。

| 类别 | 验证内容 |
| --- | --- |
| 解析测试 | 真实 Audio fixture、时间格式、缺省字段、嵌套同名字段、无效数值、组内音频、rawXml 保留与诊断 |
| 播放逻辑测试 | 裁剪终点、片段循环、打点/拖动边界、播放失败恢复、切页和重复 effect；DOM 模拟只验证状态逻辑，不视为真实解码成功 |
| 页面集成 | 当前页与非当前页、跨页保活、停止页、回退重进、过场、入场/退场动画、缩略图绝不发声、编辑预览 |
| 实际播放 | 浏览器、Electron 和 ICC-CE WebView2 中使用真实音频验证声音、进度、音量、长音频拖动及自动播放限制 |
| 异常与清理 | 资源缺失、损坏文件、不支持编码、连续开关课件、关闭时无残留声音，多次切页无重复实例 |
| 视觉与交互 | 与官方参照比较图标/控制条；验证缩放、旋转、画布边缘、鼠标/触摸和键盘操作不误翻页 |

验收标准：真实 ENBX 中 Audio 不再显示为未知元素；可正常播放、暂停、拖动和调音量；裁剪及循环符合确认的语义；普通/跨页/隐藏音频生命周期正确；浏览器限制有恢复入口；现有视频播放和页面动画无回归。

## 8. 交付顺序

1. P0：官方模型、样式、时间/行为语义取证，得到真实 fixture 和研究记录。
2. P1：类型、解析、资源及诊断接入，确保 Audio 进入正确渲染分支。
3. P2：基础播放与官方相似样式，完成裁剪、循环、音量、进度和已有打点。
4. P3：跨页、隐藏、动画、编辑和自动播放恢复，再完成三端实播验证。
5. 同步 `enbx_docs/04-元素规范-文本图形多媒体.md` 与 `06-兼容性与未支持清单.md`，说明已支持行为和格式限制，按仓库要求提交并推送。

首版不实现音频剪辑编辑、打点新增/保存、格式转码或云端音频服务。保留原始 XML，后续写回能力可独立扩展。
