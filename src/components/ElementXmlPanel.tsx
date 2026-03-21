import Editor from '@monaco-editor/react'
import { styles } from '../styles'
import type { SlideElement } from '../parser'

interface ElementXmlPanelProps {
  element: SlideElement
  slideNumber: number
  onClose: () => void
}

export function ElementXmlPanel({ element, slideNumber, onClose }: ElementXmlPanelProps) {
  const xmlContent = element.rawXml || '<!-- 暂未捕获该元素原始 XML -->'

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
      </div>
      <div style={styles.elementXmlPanelEditor}>
        <Editor
          language='xml'
          value={xmlContent}
          theme='vs-dark'
          options={{
            readOnly: true,
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
