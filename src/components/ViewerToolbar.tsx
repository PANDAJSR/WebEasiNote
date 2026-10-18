import { Button } from 'antd'
import { styles } from '../styles'

interface ViewerToolbarProps {
  name: string
  currentIndex: number
  pageCount: number
  isEditMode: boolean
  isSaving: boolean
  issueButtonText: string
  onToggleMode: () => void
  onSaveAs: () => void
  onIssues: () => void
  onClear: () => void
}

export function ViewerToolbar(props: ViewerToolbarProps) {
  return <div style={styles.toolbar}>
    <div style={styles.toolbarLeft}>
      <span style={styles.coursewareName}>{props.name}</span>
      <span style={styles.slideInfo}>第 {props.currentIndex + 1} / {props.pageCount} 页</span>
    </div>
    <div style={styles.toolbarRight}>
      <Button onClick={props.onToggleMode} style={styles.modeToggleButton}>
        {props.isEditMode ? '播放模式' : '编辑模式'}
      </Button>
      <Button onClick={props.onSaveAs} loading={props.isSaving} style={styles.saveAsButton}>另存为</Button>
      <Button onClick={props.onIssues} style={styles.issueButton}>{props.issueButtonText}</Button>
      <Button type='text' onClick={props.onClear} style={styles.clearButton}>关闭</Button>
    </div>
  </div>
}
