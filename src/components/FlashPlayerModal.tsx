import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, Modal, Space, Spin, Tooltip } from 'antd'
import {
  CloseOutlined,
  MutedOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SoundOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined
} from '@ant-design/icons'
import type { FlashElement } from '../flashes'
import { createRufflePlayer, destroyRufflePlayer, loadSwf } from '../ruffle-runtime'
import type { RufflePlayer } from '../types/ruffle'

type PlaybackStatus = 'loading' | 'ready' | 'error'

interface FlashPlayerModalProps {
  open: boolean
  element: FlashElement
  sourceUrl: string
  onClose: () => void
}

/**
 * Flash 页内播放弹窗
 *
 * 与官方 FlashPlayerWindow 的差异：官方有基于 CurrentFrame/GotoFrame 的帧进度条，
 * Ruffle 未提供帧级 API，因此控制条降级为播放/暂停 + 重播 + 静音 + 全屏。
 */
export function FlashPlayerModal({ open, element, sourceUrl, onClose }: FlashPlayerModalProps) {
  const { flashName, flashWidth, flashHeight } = element
  const [opened, setOpened] = useState(false)
  const [status, setStatus] = useState<PlaybackStatus>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // 递增即重建播放器，用于「重播」（Ruffle 无回到首帧的 API）
  const [session, setSession] = useState(0)
  const hostRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<RufflePlayer | null>(null)

  const stageRatio = flashHeight > 0 ? flashWidth / flashHeight : 4 / 3

  useEffect(() => {
    if (!opened) {
      destroyRufflePlayer(playerRef.current)
      playerRef.current = null
      return
    }
    const host = hostRef.current
    if (!host) return
    let disposed = false
    setStatus('loading')
    setErrorMessage('')
    createRufflePlayer(host)
      .then(async player => {
        if (disposed) {
          destroyRufflePlayer(player)
          return
        }
        playerRef.current = player
        await loadSwf(player, sourceUrl)
        if (disposed) return
        setStatus('ready')
        setIsPlaying(player.isPlaying)
      })
      .catch((error: unknown) => {
        if (disposed) return
        console.warn('[Flash] 播放器初始化失败:', error)
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : String(error))
      })
    return () => {
      disposed = true
      destroyRufflePlayer(playerRef.current)
      playerRef.current = null
    }
  }, [opened, sourceUrl, session])

  // Ruffle 不派发播放状态事件，轮询同步按钮状态
  useEffect(() => {
    if (!opened || status !== 'ready') return
    const timer = window.setInterval(() => {
      const player = playerRef.current
      if (player) setIsPlaying(player.isPlaying)
    }, 400)
    return () => window.clearInterval(timer)
  }, [opened, status])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const player = playerRef.current
    if (player) player.volume = isMuted ? 0 : 1
  }, [isMuted, status])

  const togglePlay = () => {
    const player = playerRef.current
    if (!player) return
    if (player.isPlaying) {
      player.pause()
      setIsPlaying(false)
      return
    }
    player.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
  }

  const toggleFullscreen = () => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    wrapper.requestFullscreen().catch(() => setIsFullscreen(false))
  }

  // 全屏时控制条仍保留在底部，舞台按可用高度等比撑开
  const stageWidth = `min(100%, calc(${isFullscreen ? '100vh - 48px' : '70vh'} * ${stageRatio}))`

  return (
    <Modal
      open={open}
      title={flashName || 'Flash'}
      onCancel={onClose}
      afterOpenChange={value => setOpened(value)}
      footer={null}
      centered
      destroyOnHidden
      width='min(92vw, 1180px)'
      styles={{ body: { padding: 0, background: '#000000' } }}
    >
      <div
        ref={wrapperRef}
        style={{
          background: '#000000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingBottom: 8
        }}
      >
        <div
          style={{
            width: stageWidth,
            aspectRatio: `${flashWidth} / ${flashHeight}`,
            position: 'relative',
            background: '#000000'
          }}
        >
          <div ref={hostRef} style={{ width: '100%', height: '100%' }} data-flash-stage='true' />
          {status === 'loading' && (
            <div style={overlayStyle}>
              <Spin />
              <span>正在加载 Flash 播放器…</span>
            </div>
          )}
          {status === 'error' && (
            <div style={{ ...overlayStyle, color: '#fca5a5' }}>
              <span>Flash 播放失败</span>
              <span style={{ fontSize: 12, opacity: 0.8, wordBreak: 'break-all' }}>{errorMessage}</span>
            </div>
          )}
        </div>
        <Space size={4}>
          <Tooltip title={isPlaying ? '暂停' : '播放'}>
            <Button
              type='text'
              style={controlStyle}
              icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={togglePlay}
              disabled={status !== 'ready'}
            />
          </Tooltip>
          <Tooltip title='重播'>
            <Button
              type='text'
              style={controlStyle}
              icon={<ReloadOutlined />}
              onClick={() => setSession(value => value + 1)}
              disabled={status !== 'ready'}
            />
          </Tooltip>
          <Tooltip title={isMuted ? '取消静音' : '静音'}>
            <Button
              type='text'
              style={controlStyle}
              icon={isMuted ? <MutedOutlined /> : <SoundOutlined />}
              onClick={() => setIsMuted(value => !value)}
              disabled={status !== 'ready'}
            />
          </Tooltip>
          <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
            <Button
              type='text'
              style={controlStyle}
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
            />
          </Tooltip>
          <Tooltip title='关闭'>
            <Button type='text' style={controlStyle} icon={<CloseOutlined />} onClick={onClose} />
          </Tooltip>
        </Space>
      </div>
    </Modal>
  )
}

const controlStyle: CSSProperties = { color: '#ffffff' }

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  color: '#e5e7eb',
  background: '#000000',
  fontSize: 13
}
