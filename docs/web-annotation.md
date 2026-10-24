# Web 放映批注

## 使用

浏览器和 Electron 的播放模式显示批注工具栏：播放、选择、画笔、面积擦、整笔擦、颜色、粗细、压感、荧光、撤销、重做、清空及冻结。嵌入 ICC-CE 时隐藏该工具栏，由宿主消息控制。

- 鼠标、触摸和手写笔使用 Pointer Events；多指可独立书写。压感开启时读取手写笔压力，无压力设备按 0.5 处理。
- 选择模式点选或套索选择课件与墨迹；Shift/Ctrl 可追加选择。选择后共用移动、等比缩放、旋转、置顶、克隆和删除。
- 圆形/矩形面积擦切分笔画，整笔擦删除命中笔画。擦除只处理批注，清空只清当前页未锁定批注。
- 面积擦反馈沿用 CE `MW_Eraser.xaml` 原始矢量外观：米白底、灰边、双凹槽；圆形为正圆，黑板擦比例 38:56。尺寸使用宿主 CSS px，不随课件缩放；按下移动时显示，抬起或取消后隐藏，整笔擦不显示面积反馈。
- 一个收笔、一次擦除手势、一次混合变换分别产生一条事务。历史按页独立，最多保留 100 条撤销记录。
- 浏览器独立运行支持 Ctrl/Cmd+Z、Ctrl+Y、Ctrl/Cmd+Shift+Z。宿主运行时由 CE 转发快捷键命令，防止重复执行。
- 书写、选择、擦除或冻结期间禁用画布点击翻页、滑动翻页和方向键翻页，暂停课堂活动交互；工具栏/宿主仍可主动翻页。
- 翻页、切换工具或设置、冻结、清空、撤销、失焦、指针取消会取消未提交的画布手势。
- 文件编辑模式使用原始编辑数据，放映批注不会出现在 XML 编辑、另存为或原始课件内容中。

数据仅保留在当前 Viewer 会话的内存中，关闭、重载、重新打开文档后清除。当前未提供跨重载快照恢复或官方 ENBX 墨迹回写。

## 场景模型

`InkElement` 是 `SlideElement` 的会话扩展，类型为 `ink`，不对应任何已确认的 ENBX 节点。解析器不生成此类型。源采样点保留局部坐标、压感与时间；变换通过外框与旋转表达，不反复修改源点。

`usePlaybackSelection` 管理课件替换、删除、临时对象、完整层序及按页事务历史；新墨迹在当前页顶层插入。面积擦片段替换在原笔画的位置，置顶与混合变换可整体撤销。

课件节点、墨迹节点与连续静态缓存段按同一顺序绘制。每个节点隔离内部堆叠上下文，避免内部媒体或控件的 z-index 越过其他对象。静态缓存不能跨越墨迹节点。选择/擦除期间保留逐对象渲染。

墨迹采用带圆头的变宽轮廓；每笔以同一个 SVG path 填充，荧光笔自身交叠不重复混合透明度。不同笔画按层序分别混合。选择按真实笔画命中；墨迹套索按中心线覆盖长度判断，课件沿用面积覆盖规则。

## WebView2 协议 v1

使用现有 `window.chrome.webview` 消息通道。Web 首次就绪或文档切换时发送：

```json
{
  "type": "enbx:annotation-ready",
  "protocolVersion": 1,
  "sessionId": "Web 生成的批注会话 UUID",
  "tools": ["play", "select", "pen", "eraser", "stroke-eraser"]
}
```

此 `sessionId` 属于 Web 批注会话，与云课件加载会话 ID 独立。宿主应保存最新 ID，并在收到 ready 后重发完整工具状态。所有新批注消息必须携带此 ID；旧会话消息被忽略。可额外携带 `slideId` 限定当前页，不匹配时忽略。

宿主发送工具状态，顶层与嵌套字段都支持部分更新：

```json
{
  "type": "enbx:annotation-state",
  "sessionId": "最新批注会话 ID",
  "slideId": "可选的当前页面 ID",
  "tool": "pen",
  "brush": { "color": "#e53935", "width": 4, "opacity": 1, "pressure": true },
  "eraser": { "width": 54, "shape": "rectangle" },
  "frozen": false
}
```

`brush.width` 与 `eraser.width` 是 Web CSS 像素。Web 按当前页面显示比例换算为课件逻辑坐标；笔画提交后随课件缩放。矩形橡皮高宽比为 56/38。颜色支持 `#RRGGBB` 或 `#RRGGBBAA`，笔宽限 0.25～256，橡皮宽限 4～512。冻结阻止画布修改及历史操作，保留播放工具选择与冻结状态通知。

一次性操作：

```json
{
  "type": "enbx:annotation-command",
  "sessionId": "最新批注会话 ID",
  "slideId": "当前页面 ID",
  "commandId": "每次操作唯一的 ID",
  "command": "undo"
}
```

支持 `clear`、`undo`、`redo`。有效且匹配当前页的 commandId 去重窗口为最近 1000 个请求；重复请求不重放。宿主应生成新 ID，而非跨页复用。

接收合法命令后回传 `enbx:annotation-result`，携带 `sessionId`、`slideId`、`commandId`、`success`；冻结或文件编辑模式下返回 `success: false` 与中文 `error`。成功表示命令已被接受；实际 UI 提交后的状态由 status 报告。错误会话、错误页或无效命令不执行、不回执。没有历史或没有墨迹时，合法命令成功但不产生变更。

每次工具状态、页面或场景历史变化后，Web 发送：

```json
{
  "type": "enbx:annotation-status",
  "sessionId": "当前批注会话 ID",
  "slideId": "当前页面 ID",
  "state": {
    "tool": "pen",
    "brush": { "color": "#e53935", "width": 4, "opacity": 1, "pressure": false },
    "eraser": { "width": 54, "shape": "rectangle" },
    "frozen": false
  },
  "canUndo": true,
  "canRedo": false
}
```

兼容旧的 `enbx:set-interaction-mode`：`select` 进入选择，其他值进入播放。旧插件不启用新批注能力时继续走原来的宿主墨迹路径。

## CE 与插件接入

CE 的演示源 SDK 已增加外部批注能力，ENBX 插件通过该能力转发工具和命令。接管期间 CE 隐藏上层墨迹画布、关闭 WPF/WinRT 输入和原生橡皮，保留工具栏；状态回传更新 CE 的撤销/重做按钮。插件不运行 `HostInkPageBridge`，墨迹和历史由 Web 管理。

需要同时更新 CE 主程序、PluginSdk 和 ENBX 插件；仅更新本仓库的前端不会让旧宿主自动切换输入。构建、接口和实际 WebView2 集成测试见相邻插件仓库的 `docs/web-annotation-integration.md`。

## 当前精度与限制

### CE 笔刷扩展

宿主 `brush` 可额外传入以下字段，省略时保留旧协议行为：

| 字段 | 含义 |
| --- | --- |
| `kind` | `pen`、`highlighter`、`laser` |
| `height`, `tip` | 笔尖高度（CSS px）及 `ellipse` / `rectangle`；CE 荧光笔宽为高度的一半 |
| `inkStyle` | CE 存储值：0 点集收锋，1 速率，2 关闭，3 实时速度与硬件压力混合 |
| `velocityMix`, `minDistanceScale` | 实时笔锋混合系数及采样距离比例 |
| `smoothing`, `smoothingQuality` | 收笔五次贝塞尔平滑开关及质量 0/1/2 |
| `highlighterOverlap` | 宿主荧光重叠设置；目前跨笔画仍按独立对象混合，见下方限制 |
| `fadeEnabled`, `fadeDelay`, `fadeSpeed` | 激光消退开关、抬笔后等待毫秒数、书写时长的消退速度倍率 |

实时笔锋移植 CE 的 OneEuroFilter、采样率归一化速度、压力混合与鼠标/笔中点链；触摸采用转角自适应的 3～5 步插值。速度与阈值以 CSS px（对应宿主 DIP）计算，再换算页面坐标。点集和速率收笔保留已有硬件压力。高级平滑采用 CE 默认异步分支的五次滑窗、质量参数、0.1 DIP 去重和最多三倍点数的等距采样。

激光使用 CE 的三层圆头中心线：外发光 0.22、彩色主体 0.92、近白色内芯 0.98，宽度及混白系数对应 `InkFadeManager`。消退为 CubicEase EaseInOut，缩放为 QuadraticEase EaseIn 至 0.985；动画时长为书写时长 / 速度倍率（至少 20ms，无时长时回退 2000ms）。激光为独立瞬态视觉，不参与选择、擦除和撤销历史，清空可移除当前页光迹。跨页仍按原始抬笔时间过期。

- 面积擦使用扫掠凸多边形与线性压力中心线裁剪；圆形采用外接 32 边形，笔画半径扩张裁剪平面。转角边缘是近似，尚不保证与 WPF IncrementalStrokeHitTester 逐像素一致。
- 普通笔、矩形荧光、四种笔锋、CE 默认异步高级平滑和三层激光已接入。WPF 内建 FitToCurve、同步/GPU 平滑回退分支、不同笔画间的荧光去重叠、形状识别、手掌擦和笔尾擦尚未完整对齐。SVG 高斯模糊与 WPF BlurEffect 也不保证逐像素一致。
- 面积擦目前遍历当前页墨迹，尚未建立空间索引；大量长笔画需要真机性能评估后进一步优化。
- 课堂活动沿用现有独立交互覆盖层。批注模式中暂停并隐藏活动覆盖层，返回播放后恢复；它们尚未作为普通课件对象参与任意层序重排。
- 自动测试使用 happy-dom 与 SVG 栅格器，覆盖混合变换、层序、压力、擦除、取消、分页、冻结及协议。WebView2 触控屏输入延迟和设备压力仍需真机验证。
