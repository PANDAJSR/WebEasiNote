# 宿主文档视图

`src/documents/` 是独立 PDF 阅读视图，不把文档页转换为 ENBX slide。`DocumentShell` 根据宿主 `enbx:open` 的 `sourceKind` 在 ENBX App 与 PDF Viewer 之间切换；同一会话重复 open 不重新加载，App 重挂载时请求宿主补发当前源。

## 模块

- `DocumentViewer.tsx`：页面尺寸、布局、阅读锚点、页码、工具条和键盘操作。
- `model.ts` / `view-settings.ts`：页面坐标布局、可见页二分查找、惯性积分、JSON 验证和按文档记忆的阅读设置。
- `pdf-provider.ts` / `PdfPage.tsx`：PDF.js、双任务绘制队列、约 120 ms 静止重绘、画布像素预算；离屏页卸载并释放画布，旧图在重绘期间保留。
- `useDocumentAnnotation.ts`：CE 批注状态、文档级历史、旁路 JSON 恢复 / 自动保存 / flush 和临时激光。
- `useDocumentGestures.ts`：首指可回滚预览、双指仲裁 / 平移 / 捏合、rAF 合帧、滚动惯性、指针捕获与统一取消。

页面逻辑坐标采用 PDF.js 在原生旋转 / CropBox 下得到的页面 point，DPR 只参与画布像素分辨率。已提交和临时墨迹与页面在同一个 DOM 节点中缩放 / 滚动，不逐帧经过宿主桥接。首指约 100 ms 的识别窗需真机校准，持续书写后的迟到触点不会抢走笔画。

## 桥接摘要（版本 1）

宿主必须只授权当前文档的二进制与 JSON URL，处理保存完成回执，并将旧会话的迟到消息丢弃。

| 方向 | 消息 | 主要字段 / 行为 |
| --- | --- | --- |
| Host → Web | `enbx:open` | `sourceKind: 'pdf'`, `protocolVersion: 1`, `documentSessionId`, `documentKey`（PDF SHA-256）, `url`, `annotationsUrl`, `fileName` |
| Web → Host | `document:attached` | `documentSessionId`；批注接收器已挂载，退出时可发 flush |
| Web → Host | `document:loaded` / `document:page-changed` | 会话 ID、`pageCount/currentPage` 或 `page`（1-based） |
| Host → Web | `document:navigate` | 会话 ID、`direction`, `requestId`；按列数切换相邻行 |
| Web → Host | `document:navigation-complete` | 会话 ID、`requestId`, `page`（实际 1-based 页码） |
| Host → Web | `document:toggle-pages` | 会话 ID；打开跳页对话框 |
| Web → Host | `document:save` | 会话 ID、`requestId`, `protocolVersion`, `text`（完整 JSON 快照） |
| Host → Web | `document:saved` | 会话 ID、`requestId`, `success`, 可选 `error`；只在原子写入成功后回 true |
| Host → Web | `document:flush` | 会话 ID、`requestId`；取消活动手势、阻止新输入并保存已提交数据 |
| Web → Host | `document:flushed` | 会话 ID、`requestId`, `success/error`；保存失败重新允许输入 |
| Web → Host | `document:close` / `document:error` | 会话 ID；请求退出或报告加载错误 |
| Host → Web | `document:closed` | 会话 ID；卸载阅读视图 |

CE 工具使用已有 `enbx:annotation-*` 协议，每次挂载产生新的批注 `sessionId`；Web 发往 Host 的文档批注消息还携带 `documentSessionId`，避免与 ENBX 或旧 PDF 会话混用。

批注 JSON 为 `{ version: 1, pages: { "0": InkElement[] } }`，页索引为 0-based，身份由 URL 与宿主 SHA-256 文件名绑定。输入校验失败禁用修改，不覆盖损坏数据；临时激光不加入持久笔画或历史。保存失败显示可重试状态。宿主需在收到成功 flush 后关闭；没有发起关闭的 flush 会保持输入锁定，若放弃关闭需要重开会话。

## 首版边界与验证

只在 CE-ENBX 宿主消息入口启用，尚未增加浏览器 / Electron 的 PDF 文件选择器。Word 在插件中本地转换，前端只读取生成的 PDF。

支持单 / 双列与连续 / 分页的四种组合、20%–400% 缩放、适合宽度 / 整页、当前页清空、整份文档撤销 / 重做与阅读设置记忆。不支持套索编辑、缩略图、封面独占、奇数尾页空位、阅读方向、用户旋转、文本搜索 / 复制和批注 PDF 导出。整页画布有 8192 边长上限与约 96 MiB 目标预算，未实现瓦片 / 全量 LRU / 大量笔画位图缓存，不能把此预算理解为 PDF 解码和 GPU 的进程总内存上限。

`tests/document-layout.test.ts` 覆盖混合纸张、分页身份、可见行二分查找、惯性真实时间积分与损坏批注校验；完整 `pnpm test` 当前 200/200 通过。插件 `tests/Documents` 通过真实 WebView2 的绘制、工具 / 历史、持久化、双指滚动 / 惯性 / 缩放、退出清理、PDF 与 ENBX 切换、占用写入失败 / 重试及损坏 JSON 不覆盖验证。独立测试不能替代 CE + 4K 触屏的笔延迟、手掌、窗口穿透、DPI 与性能验收。
