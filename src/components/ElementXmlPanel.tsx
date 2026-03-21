import Editor from '@monaco-editor/react'
import { styles } from '../styles'
import type { SlideElement } from '../parser'

interface ElementXmlPanelProps {
  element: SlideElement
  slideNumber: number
  xmlContent: string
  xmlError: string | null
  onXmlChange: (value: string) => void
  onClose: () => void
}

export function ElementXmlPanel({
  element,
  slideNumber,
  xmlContent,
  xmlError,
  onXmlChange,
  onClose
}: ElementXmlPanelProps) {
  return (
    <div style={styles.elementXmlPanel}>
      <div style={styles.elementXmlPanelHeader}>
        <div style={styles.elementXmlPanelTitle}>
          第 {slideNumber} 页 · 元素 XML
        </div>
        <button style={styles.elementXmlPanelCloseButton} onClick={onClose}>
          关闭
        </button>
      </div>
      <div style={styles.elementXmlPanelMeta}>
        <span>ID: {element.id}</span>
        <span>类型: {element.type}</span>
        <span>状态: {xmlError ? 'XML 解析失败（未同步）' : '实时同步中'}</span>
      </div>
      {xmlError && (
        <div style={styles.elementXmlPanelError}>
          {xmlError}
        </div>
      )}
      <div style={styles.elementXmlPanelEditor}>
        <Editor
          language='xml'
          value={xmlContent}
          onChange={value => onXmlChange(value || '')}
          theme='vs-dark'
          options={{
            minimap: { enabled: false },
            automaticLayout: true,
            wordWrap: 'on',
            fontSize: 13,
            scrollBeyondLastLine: false
          }}
        />
      </div>
    </div>
  )
}
