import { lazy, Suspense, useLayoutEffect, useState } from 'react'
import App from '../App'
import { subscribeToEnbxHost } from '../platform/host-bridge'
import type { DocumentSource } from './model'

const DocumentViewer = lazy(() => import('./DocumentViewer'))

/** 与 ENBX 独立挂载，避免两个播放器同时处理工具和导航。 */
export function DocumentShell() {
  const [source, setSource] = useState<DocumentSource | null>(null)
  useLayoutEffect(() => subscribeToEnbxHost(message => {
    if (message.type === 'enbx:open') {
      if (message.sourceKind === 'pdf' && typeof message.url === 'string'
        && typeof message.annotationsUrl === 'string' && typeof message.documentSessionId === 'string') {
        const source = { url: message.url, annotationsUrl: message.annotationsUrl,
          documentSessionId: message.documentSessionId, fileName: String(message.fileName || '文档.pdf'),
          documentKey: String(message.documentKey || message.fileName || '') }
        setSource(previous => previous?.documentSessionId === source.documentSessionId ? previous : source)
      } else setSource(null)
    }
    if (message.type === 'document:closed' && message.documentSessionId === source?.documentSessionId) setSource(null)
  }), [source?.documentSessionId])
  return source ? <Suspense fallback={<div>正在加载文档查看器…</div>}>
    <DocumentViewer key={source.documentSessionId} source={source} />
  </Suspense> : <App />
}
