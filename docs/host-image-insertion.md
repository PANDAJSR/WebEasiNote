# 宿主手机传图

宿主通过现有 WebView2 `chrome.webview` 消息桥向正在播放的 WebEasiNote 发送 JSON 对象（无需 Electron）：

```json
{ "type": "insert-image", "requestId": "unique-request-id", "dataUrl": "data:image/png;base64,...", "name": "手机图片.png" }
```

`requestId` 必须是非空字符串；`dataUrl` 必须是浏览器可解码的 `data:image/...` URL；`name` 可选。使用唯一请求 ID 关联每次请求，不提供重试去重。

图片按原始比例居中插入接收请求时的当前页，最大占页面宽高的 80%，不放大小图。插入后启用现有放映选择模式，可点选、拖动、缩放、旋转、克隆、置顶或删除。通过同一消息桥回传：

```json
{ "type": "image-inserted", "requestId": "unique-request-id", "success": true }
```

成功回执在 React 提交页面数据后发送，不代表 ENBX 已保存。图片沿用放映临时元素模式，跨页保留在当前文档会话，不进入 XML 编辑及 ENBX 导出；当前放映选择层没有撤销栈，可用删除移除图片。

格式错误、图片解码失败、无当前页、解码过程中切换页面或关闭文档时失败：

```json
{ "type": "image-inserted", "requestId": "unique-request-id", "success": false, "error": "图片解码失败" }
```

宿主应等待 `enbx:document-loaded` 和 `enbx:interaction-ready` 后发送命令。本地 ENBX 和 HTTP manifest 课件共用 Viewer 中的处理逻辑。

宿主超时、用户取消或结束放映时，可发送以下命令取消尚在解码的请求：

```json
{ "type": "cancel-image", "requestId": "unique-request-id" }
```

匹配的待解码请求立即返回一次 `{ "type": "image-inserted", "requestId": "unique-request-id", "success": false, "error": "图片插入已取消" }`。迟到的解码成功或失败回调均被忽略，不会插图或再次回执。取消只影响匹配的请求，不影响其他并行请求。重复取消、未知请求和已完成请求的取消均忽略，不撤回已经插入的图片。
