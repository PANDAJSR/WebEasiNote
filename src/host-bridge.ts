export interface EnbxHostMessage {
  type: string
  [key: string]: unknown
}

interface WebViewHostWindow extends Window {
  chrome?: {
    webview?: {
      postMessage: (message: EnbxHostMessage) => void
      addEventListener: (type: 'message', listener: (event: MessageEvent<EnbxHostMessage>) => void) => void
      removeEventListener: (type: 'message', listener: (event: MessageEvent<EnbxHostMessage>) => void) => void
    }
  }
}

const hostWindow = window as WebViewHostWindow
let webReadySent = false

export function isEnbxHostRuntime() {
  return typeof hostWindow.chrome?.webview?.postMessage === 'function'
}

export function postToEnbxHost(message: EnbxHostMessage) {
  hostWindow.chrome?.webview?.postMessage(message)
}

export function subscribeToEnbxHost(
  handler: (message: EnbxHostMessage) => void
) {
  const webview = hostWindow.chrome?.webview
  if (!webview) return () => undefined

  const listener = (event: MessageEvent<EnbxHostMessage>) => {
    if (event.data && typeof event.data.type === 'string') handler(event.data)
  }
  webview.addEventListener('message', listener)
  if (!webReadySent) {
    webReadySent = true
    postToEnbxHost({ type: 'enbx:web-ready' })
  }
  return () => webview.removeEventListener('message', listener)
}
