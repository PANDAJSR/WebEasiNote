# 宿主资料夹音视频插入

图片继续使用 [现有图片协议](host-image-insertion.md)。音视频通过同一个 WebView2 `chrome.webview` 消息桥插入正在播放的本地 ENBX 或 HTTP manifest 课件：

```json
{ "type": "insert-media", "requestId": "unique-request-id", "dataUrl": "data:audio/mpeg;base64,...", "name": "资料夹音频.mp3", "mediaKind": "audio" }
```

`mediaKind` 只接受 `audio` 或 `video`，`dataUrl` 必须分别以 `data:audio/...` 或 `data:video/...` 开头。宿主需根据素材类型提供 MIME，不接受 `application/octet-stream` 或文件路径。`name` 可选，作为播放器名称使用；`requestId` 必须是非空字符串，且在每个课件会话中唯一。重复 ID 的命令被忽略，不重复插入或发送回执；重试需生成新 ID。

发送前应等待 `enbx:document-loaded` 和 `enbx:interaction-ready`。欢迎页、无有效页面、文件编辑模式均拒绝音视频插入。

前端使用浏览器加载媒体元数据，确认有限且大于零的时长；视频同时检查原始宽高。成功后插入接收请求时的当前页，视频按比例居中，最大占页面宽高的 80%，不放大小视频；音频使用现有 111 × 48 播放条居中显示。插入后切换到播放工具，用户可直接点击控件播放，默认不自动播放、不循环、不跨页播放。切换到选择工具后可使用现有放映选择能力移动、复制或删除。

React 提交页面元素后回复：

```json
{ "type": "media-inserted", "requestId": "unique-request-id", "success": true }
```

格式错误、媒体损坏或 WebView2 不支持编码、无效时长或尺寸、加载超过 10 秒、加载期间切页/退出播放/切换课件/关闭课件时回复失败，例如：

```json
{ "type": "media-inserted", "requestId": "unique-request-id", "success": false, "error": "媒体加载超时，请重试" }
```

成功表示媒体元数据已验证且临时元素已提交，不代表完整媒体播放或 ENBX 保存已完成。媒体编解码能力取决于 WebView2；官方支持而 WebView2 无法解码的格式需要宿主转换后再发送。所有插入元素和资源只在当前课件会话内保留，跨页返回仍存在，替换课件或卸载 Viewer 后清理，不进入 ENBX 导出。

宿主取消、超时或结束放映时可取消未完成请求：

```json
{ "type": "cancel-media", "requestId": "unique-request-id" }
```

匹配的未完成请求只回复一次失败，`error` 为 `媒体插入已取消`，并清理解码器、超时计时器和尚未确认的元素。已排队的迟到事件不会再次插入或回执。不同请求独立取消；未知、重复或成功回执后的取消忽略，不删除已插入的媒体。宿主如自行设置等待超时，建议留出超过前端 10 秒的余量，并在放弃请求时发送取消命令。
