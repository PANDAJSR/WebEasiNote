import Editor from '@monaco-editor/react'
import { Button } from 'antd'
import { styles } from '../styles'
import type { SlideElement } from '../parser'

interface ElementXmlPanelProps {
  element: SlideElement | null
  slideNumber: number
  xmlContent: string
  xmlError: string | null
  isSlideXml: boolean
  onXmlChange: (value: string) => void
  onClearSelection?: () => void
}

export function ElementXmlPanel({
  element,
  slideNumber,
  xmlContent,
  xmlError,
  isSlideXml,
  onXmlChange,
  onClearSelection
}: ElementXmlPanelProps) {
  return (
    <div style={styles.elementXmlPanel}>
      <div style={styles.elementXmlPanelTabContent}>
        <div style={styles.elementXmlPanelTabRail}>
          <Button size='small' style={{ ...styles.elementXmlPanelTabButton, ...styles.elementXmlPanelTabButtonActive }}>
            Raw
          </Button>
        </div>
        <div style={styles.elementXmlPanelTabBody}>
          <div style={styles.elementXmlPanelHeader}>
            <div style={styles.elementXmlPanelTitle}>
              第 {slideNumber} 页 · {isSlideXml ? '页面 XML' : '元素 XML'}
            </div>
            {!isSlideXml && onClearSelection && (
              <Button size='small' style={styles.elementXmlPanelCloseButton} onClick={onClearSelection}>
                取消选中
              </Button>
            )}
          </div>
          <div style={styles.elementXmlPanelMeta}>
            {isSlideXml ? (
              <>
                <span>范围: 当前页面完整 XML</span>
                <span>状态: 仅展示</span>
              </>
            ) : (
              <>
                <span>ID: {element?.id}</span>
                <span>类型: {element?.type}</span>
                <span>状态: {xmlError ? 'XML 解析失败（未同步）' : '实时同步中'}</span>
              </>
            )}
          </div>
          {xmlError && (
            <div style={styles.elementXmlPanelError}>
              {xmlError}
            </div>
          )}
          <div style={styles.elementXmlPanelEditor}>
            <Editor
              language='xml'
              height='100%'
              value={xmlContent}
              onChange={value => {
                if (isSlideXml) return
                onXmlChange(value || '')
              }}
              theme='vs'
              options={{
                minimap: { enabled: false },
                automaticLayout: true,
                wordWrap: 'on',
                fontSize: 13,
                scrollBeyondLastLine: false,
                readOnly: isSlideXml
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
