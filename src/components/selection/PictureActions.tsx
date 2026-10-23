import { useState } from 'react'
import { Button, Modal, Slider } from 'antd'
import type { PictureElement } from '../../types'
import { selectionStyles as styles } from './styles'
import { PictureRenderer } from '../PictureRenderer'
import { cropSelectionPicture } from '../../viewer/selection-picture'

interface PictureActionsProps {
  picture: PictureElement
  resourceMap: Record<string, string>
  onChange: (picture: PictureElement) => void
}

export function PictureActions({ picture, resourceMap, onChange }: PictureActionsProps) {
  const [cropping, setCropping] = useState(false)
  const [range, setRange] = useState({ left: 0, top: 0, right: 100, bottom: 100 })
  const source = resourceMap[picture.sourceId]
  const handleExport = async () => {
    try {
      const response = await fetch(source)
      if (!response.ok) throw new Error('图片资源尚未加载完成')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = picture.pictureName || '图片.png'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      Modal.error({ title: '导出失败', content: (error as Error).message })
    }
  }
  const handleCrop = async () => {
    try {
      const image = new Image()
      image.src = source
      await image.decode()
      const size = picture.pictureSize || { width: image.naturalWidth, height: image.naturalHeight }
      onChange(cropSelectionPicture(picture, range, size))
      setCropping(false)
    } catch (error) {
      Modal.error({ title: '裁剪失败', content: (error as Error).message })
    }
  }
  return <>
    <button style={styles.button} disabled={!source} onClick={() => void handleExport()}>导出</button>
    <button style={styles.button} disabled={!source} onClick={() => {
      setRange({ left: 0, top: 0, right: 100, bottom: 100 }); setCropping(true)
    }}>裁剪</button>
    <Modal title='裁剪图片' open={cropping} onCancel={() => setCropping(false)}
      footer={<><Button onClick={() => setCropping(false)}>取消</Button><Button type='primary' onClick={() => void handleCrop()}>应用</Button></>}>
      <div style={{ position: 'relative', marginBottom: 16,
        width: picture.width * Math.min(460 / picture.width, 320 / picture.height),
        height: picture.height * Math.min(460 / picture.width, 320 / picture.height), maxWidth: '100%' }}>
        <PictureRenderer element={{ ...picture, x: 0, y: 0, rotation: 0 }} resourceMap={resourceMap}
          scale={Math.min(460 / picture.width, 320 / picture.height)} />
        <div style={{ position: 'absolute', left: `${range.left}%`, top: `${range.top}%`,
          width: `${range.right - range.left}%`, height: `${range.bottom - range.top}%`,
          border: '2px solid #168cff', boxSizing: 'border-box', pointerEvents: 'none' }} />
      </div>
      {(['left', 'top', 'right', 'bottom'] as const).map((edge, index) => <label key={edge} style={{ display: 'block' }}>
        {['左', '上', '右', '下'][index]} {range[edge]}%
        <Slider min={0} max={100} value={range[edge]}
          onChange={value => {
            setRange(previous => ({ ...previous, [edge]: edge === 'left' ? Math.min(value, previous.right - 1)
              : edge === 'right' ? Math.max(value, previous.left + 1) : edge === 'top' ? Math.min(value, previous.bottom - 1)
                : Math.max(value, previous.top + 1) }))
          }} />
      </label>)}
    </Modal>
  </>
}
