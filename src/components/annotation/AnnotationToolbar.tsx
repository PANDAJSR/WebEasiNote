import { Button, ColorPicker, InputNumber, Segmented, Space, Switch } from 'antd'
import type { AnnotationTool } from '../../types'
import type { PlaybackAnnotation } from '../../viewer/usePlaybackSelection'
import { annotationStyles as styles } from './styles'

export function AnnotationToolbar({ annotation }: { annotation: PlaybackAnnotation }) {
  const { state, setState, command, canUndo, canRedo } = annotation
  return <div role='toolbar' aria-label='课件批注' data-annotation-toolbar style={styles.toolbar}>
    <Segmented value={state.tool} onChange={tool => setState({ tool: tool as AnnotationTool })}
      options={[{ label: '播放', value: 'play' }, { label: '选择', value: 'select' },
        { label: '画笔', value: 'pen' }, { label: '面积擦', value: 'eraser' }, { label: '整笔擦', value: 'stroke-eraser' }]} />
    <Space>
      <ColorPicker value={state.brush.color} disabled={state.frozen}
        onChangeComplete={color => setState({ brush: { color: color.toHexString() } })} />
      <InputNumber aria-label='画笔粗细' min={0.25} max={256} value={state.brush.width} disabled={state.frozen}
        onChange={width => { if (width !== null) setState({ brush: { width } }) }} />
      <Switch checkedChildren='压感' unCheckedChildren='压感' checked={state.brush.pressure}
        disabled={state.frozen} onChange={pressure => setState({ brush: { pressure } })} />
      <Switch checkedChildren='荧光' unCheckedChildren='荧光' checked={state.brush.opacity < 1}
        disabled={state.frozen} onChange={enabled => setState({ brush: { opacity: enabled ? 0.35 : 1 } })} />
    </Space>
    {(state.tool === 'eraser' || state.tool === 'stroke-eraser') && <Space>
      <InputNumber aria-label='橡皮尺寸' min={4} max={512} value={state.eraser.width} disabled={state.frozen}
        onChange={width => { if (width !== null) setState({ eraser: { width } }) }} />
      <Segmented value={state.eraser.shape} options={[{ label: '矩形', value: 'rectangle' }, { label: '圆形', value: 'circle' }]}
        onChange={shape => setState({ eraser: { shape } })} />
    </Space>}
    <Button disabled={!canUndo || state.frozen} onClick={() => command('undo')}>撤销</Button>
    <Button disabled={!canRedo || state.frozen} onClick={() => command('redo')}>重做</Button>
    <Button disabled={state.frozen} onClick={() => command('clear')}>清空批注</Button>
    <Switch checkedChildren='已冻结' unCheckedChildren='冻结' checked={state.frozen}
      onChange={frozen => setState({ frozen })} />
  </div>
}
