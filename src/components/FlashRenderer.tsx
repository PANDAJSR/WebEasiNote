import { useEffect, useId, useState } from 'react'
import type { FlashElement } from '../flashes'
import { FlashPlayerModal } from './FlashPlayerModal'

/** 官方 FlashElementContent.xaml 的红色圆形按钮路径 */
const CIRCLE_PATH = 'M0,32 A32,32 0 0 1 64,32A32,32 0 0 1 0,32'
/** Image.Flash：字母 f（自然尺寸 25×30） */
const FLASH_GLYPH = 'M16.6533782,19.3333333C15.1436632,22.8897268 14.1698349,24.6907242 12.5985041,26.5805817 10.0267849,29.6736176 6.66362228,31.3333333 2.33333333,31.3333333L2.33333333,25.3333333C6.79848677,25.3333333 8.59309865,23.1749332 11.791813,15.4036313 11.835447,15.2976173 11.835447,15.2976173 11.8792033,15.1913165 13.8185318,10.4803969 14.8847451,8.35222668 16.7481212,6.14704786 19.3974214,3.0117814 22.8650152,1.33333333 27.3333333,1.33333333L27.3333333,7.33333333C23.5463281,7.33333333,21.5672565,8.76393694,19.2773752,13.3333333L24.3333333,13.3333333 24.3333333,19.3333333 16.6533782,19.3333333z'
/** Image.Play：播放三角（自然尺寸 17.028×23.855） */
const PLAY_GLYPH = 'M5.2006778603764,22.6456646530727C5.1862159603764,24.1943576513727 6.7427420603765,24.4303011980727 7.5642769603763,23.8462871870727 9.9726767603764,22.1342003530727 18.8791709603764,15.5166465930727 21.4998937303764,13.6097421930728 22.4790468403764,12.8881798930727 22.4365882103764,11.6195985930728 21.5838783603764,10.7702140930728 18.7353720603765,8.6754600930727 10.9273886603764,3.0942831930727 7.5849468603764,0.7253737930728 6.7557944603764,0.1377234930728 5.2001134603764,-0.1865072069273 5.2006778603764,1.9057285930727L5.2006778603764,22.6456646530727Z'
/**
 * 字形平移量 = 32×32 字形区在 64×64 内的居中量 16 + 区内居中偏移 + 官方 Margin - 字形包围盒原点
 * f：原生 25×30，包围盒起点 (2.333, 1.333)，Margin -3
 *   → x = 16 + (32-25)/2 - 3 - 2.333 = 14.167，y = 16 + (32-30)/2 - 1.333 = 15.667
 * 三角：原生 17.028×23.855，包围盒起点 (5.201, 0.284)，Margin +5
 *   → x = 16 + (32-17.028)/2 + 5 - 5.201 = 23.285，y = 16 + (32-23.855)/2 - 0.284 = 19.789
 * 校验：f 占位 x[16.5,41.5] y[17,47]、三角 x[28.5,45.5] y[20.07,43.93]，两者垂直中心均为 32
 */
const FLASH_GLYPH_TRANSFORM = 'translate(14.167 15.667)'
const PLAY_GLYPH_TRANSFORM = 'translate(23.285 19.789)'

interface FlashRendererProps {
  element: FlashElement
  scale: number
  resourceMap: Record<string, string>
  /** 编辑模式下单击交给父级选中/拖拽，双击才预览 */
  isEditMode?: boolean
  /** 非当前页时强制关闭弹窗，与原版「窗口随页面关闭」一致 */
  isCurrentSlide?: boolean
}

/**
 * Flash 元素渲染器：复刻官方红色圆形图标，点击后弹出页内播放窗口
 */
export function FlashRenderer({
  element,
  scale,
  resourceMap,
  isEditMode = false,
  isCurrentSlide = true
}: FlashRendererProps) {
  const { x, y, width, height, rotation, sourceId, flashName } = element
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const shadowId = `flash-shadow-${useId().replace(/:/g, '')}`
  const sourceUrl = resourceMap[sourceId] || null

  useEffect(() => {
    if (!isCurrentSlide) setOpen(false)
  }, [isCurrentSlide])

  if (!sourceUrl) {
    return (
      <div
        style={{
          position: 'absolute',
          left: x * scale,
          top: y * scale,
          width: width * scale,
          height: height * scale,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: 'center center',
          backgroundColor: '#fee2e2',
          border: `${Math.max(1, scale)}px solid #ef4444`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10 * scale,
          color: '#991b1b',
          textAlign: 'center',
          overflow: 'hidden',
          pointerEvents: 'none'
        }}
      >
        Flash 资源未加载
      </div>
    )
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x * scale,
          top: y * scale,
          width: width * scale,
          height: height * scale,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: 'center center',
          cursor: isEditMode ? 'move' : 'pointer'
        }}
        title={flashName || 'Flash'}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={event => {
          if (isEditMode) return
          event.stopPropagation()
          setOpen(true)
        }}
        onDoubleClick={event => {
          if (!isEditMode) return
          event.stopPropagation()
          event.preventDefault()
          setOpen(true)
        }}
      >
        {/* 2px 描边与 DropShadow 会超出 64×64 视口，官方 Viewbox 以含描边的边界为准，故放开裁剪 */}
        <svg
          viewBox='0 0 64 64'
          width='100%'
          height='100%'
          role='img'
          aria-label={flashName || 'Flash'}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <filter id={shadowId} x='-20%' y='-20%' width='140%' height='140%'>
              {/* 对应 WPF DropShadowEffect BlurRadius=8 / ShadowDepth=0 / Opacity=0.3 */}
              <feDropShadow dx='0' dy='0' stdDeviation='4' floodColor='#000000' floodOpacity='0.3' />
            </filter>
          </defs>
          <path
            d={CIRCLE_PATH}
            fill='#E34A4A'
            stroke='#FFFFFF'
            strokeWidth={2}
            filter={`url(#${shadowId})`}
          />
          <path
            d={hovered ? PLAY_GLYPH : FLASH_GLYPH}
            transform={hovered ? PLAY_GLYPH_TRANSFORM : FLASH_GLYPH_TRANSFORM}
            fill='#FFFFFF'
            fillOpacity={0.8}
            fillRule={hovered ? 'evenodd' : 'nonzero'}
          />
        </svg>
      </div>
      <FlashPlayerModal
        open={open}
        element={element}
        sourceUrl={sourceUrl}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
