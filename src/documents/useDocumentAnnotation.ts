import { useEffect, useRef, useState } from 'react'
import type { InkElement } from '../types/annotation'
import { defaultAnnotationState, patchAnnotationState } from '../viewer/annotation/annotation-state'
import { postToEnbxHost, subscribeToEnbxHost } from '../platform/host-bridge'
import { parseDocumentInk, type DocumentInk, type DocumentSource } from './model'
import { useLaserInk } from '../viewer/annotation/useLaserInk'

interface Transaction { page: number; before: InkElement[]; after: InkElement[] }

export function useDocumentAnnotation(source: DocumentSource, navigate: (page: number) => void, current: number) {
  const [state, setState] = useState(defaultAnnotationState)
  const [pages, setPages] = useState<DocumentInk>({})
  const [epoch, setEpoch] = useState(0)
  const [saveStatus, setSaveStatus] = useState('正在读取批注…')
  const [ready, setReady] = useState(false)
  const session = useRef(crypto.randomUUID())
  const data = useRef({ pages: {} as DocumentInk, past: [] as Transaction[], future: [] as Transaction[], revision: 0, saved: 0 })
  const latest = useRef({ state, navigate, current })
  latest.current = { state, navigate, current }
  const pending = useRef(new Map<string, { resolve: () => void; reject: (error: Error) => void }>())
  const processed = useRef(new Set<string>())
  const saveChain = useRef(Promise.resolve())
  const laser = useLaserInk(source.documentSessionId)
  const inputBlocked = useRef(false)

  const save = () => {
    const revision = data.current.revision
    const text = JSON.stringify({ version: 1, pages: data.current.pages })
    const run = async () => {
      if (data.current.saved >= revision) return
      setSaveStatus('正在保存…')
      const requestId = crypto.randomUUID()
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => { pending.current.delete(requestId); reject(new Error('保存批注超时')) }, 15000)
        pending.current.set(requestId, {
          resolve: () => { clearTimeout(timeout); resolve() },
          reject: error => { clearTimeout(timeout); reject(error) }
        })
        postToEnbxHost({ type: 'document:save', protocolVersion: 1, documentSessionId: source.documentSessionId, requestId, text })
      })
      data.current.saved = revision
      setSaveStatus(data.current.revision === revision ? '批注已保存' : '批注待保存')
    }
    saveChain.current = saveChain.current.catch(() => undefined).then(run)
    return saveChain.current.catch(error => { setSaveStatus(`保存失败：${error.message}，点击重试`); throw error })
  }
  const commit = (page: number, after: InkElement[]) => {
    if (!ready || inputBlocked.current || latest.current.state.frozen) return
    const before = data.current.pages[page] ?? []
    if (before === after) return
    const transient = after.filter(ink => ink.brush.kind === 'laser')
    if (transient.length) {
      transient.forEach(ink => laser.add(String(page), ink))
      return
    }
    data.current.past.push({ page, before, after })
    if (data.current.past.length > 200) data.current.past.shift()
    data.current.future = []
    data.current.pages = { ...data.current.pages, [page]: after }
    data.current.revision++
    setPages(data.current.pages)
    setSaveStatus('批注待保存')
    setEpoch(value => value + 1)
  }
  const command = (command: string) => {
    if (!ready || inputBlocked.current || latest.current.state.frozen) return
    if (command === 'clear') { laser.clear(String(latest.current.current)); commit(latest.current.current, []); return }
    const undo = command === 'undo'
    const transaction = (undo ? data.current.past : data.current.future).pop()
    if (!transaction) return
    ;(undo ? data.current.future : data.current.past).push(transaction)
    data.current.pages = { ...data.current.pages, [transaction.page]: undo ? transaction.before : transaction.after }
    data.current.revision++
    setPages(data.current.pages)
    setSaveStatus('批注待保存')
    setEpoch(value => value + 1)
    latest.current.navigate(transaction.page)
  }
  const actions = useRef({ save, command })
  actions.current = { save, command }
  useEffect(() => {
    let cancelled = false
    const abort = new AbortController()
    void fetch(source.annotationsUrl, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error(`读取批注失败 (${response.status})`)
      const pages = parseDocumentInk(await response.json())
      if (cancelled) return
      data.current.pages = pages
      setPages(pages)
      setReady(true)
      setSaveStatus('批注已保存')
    }).catch(error => { if (!cancelled) setSaveStatus(`无法读取批注：${error.message}；已禁用修改`) })
    return () => { cancelled = true; abort.abort() }
  }, [source])
  useEffect(() => {
    if (!ready || data.current.saved === data.current.revision) return
    const timer = setTimeout(() => { void actions.current.save().catch(() => undefined) }, 350)
    return () => clearTimeout(timer)
  }, [pages, ready])
  useEffect(() => {
    const unsubscribe = subscribeToEnbxHost(message => {
      if (message.type === 'document:saved' && message.documentSessionId === source.documentSessionId) {
        const request = pending.current.get(String(message.requestId))
        pending.current.delete(String(message.requestId))
        if (message.success) request?.resolve()
        else request?.reject(new Error(String(message.error || '无法保存批注')))
      }
      if (message.type === 'document:flush' && message.documentSessionId === source.documentSessionId) {
        inputBlocked.current = true
        void actions.current.save().then(() => postToEnbxHost({ type: 'document:flushed',
          documentSessionId: source.documentSessionId, requestId: message.requestId, success: true }))
          .catch(error => {
            inputBlocked.current = false
            postToEnbxHost({ type: 'document:flushed', documentSessionId: source.documentSessionId,
              requestId: message.requestId, success: false, error: error.message })
          })
      }
      if (message.sessionId !== session.current) return
      if (message.type === 'enbx:annotation-state') {
        setState(previous => patchAnnotationState(previous, message))
        setEpoch(value => value + 1)
      }
      if (message.type === 'enbx:annotation-command' && ['clear', 'undo', 'redo'].includes(String(message.command))) {
        const id = String(message.commandId || '')
        if (!id || processed.current.has(id)) return
        processed.current.add(id)
        if (processed.current.size > 1000) processed.current.delete(processed.current.values().next().value!)
        actions.current.command(String(message.command))
        postToEnbxHost({ type: 'enbx:annotation-result', sessionId: session.current, commandId: id,
          documentSessionId: source.documentSessionId,
          success: ready && !inputBlocked.current && !latest.current.state.frozen })
      }
    })
    postToEnbxHost({ type: 'enbx:annotation-ready', protocolVersion: 1, sessionId: session.current, documentSessionId: source.documentSessionId })
    postToEnbxHost({ type: 'document:attached', documentSessionId: source.documentSessionId })
    return unsubscribe
  }, [source, ready])
  useEffect(() => {
    postToEnbxHost({ type: 'enbx:annotation-status', sessionId: session.current, state,
      documentSessionId: source.documentSessionId,
      canUndo: ready && !!data.current.past.length, canRedo: ready && !!data.current.future.length })
  }, [state, pages, ready])
  return { state, pages, laserPages: laser.pages, epoch, ready, inputBlocked, commit, saveStatus, save }
}
