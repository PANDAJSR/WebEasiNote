import Editor from '@monaco-editor/react'
import {
  BoldOutlined,
  CodeOutlined,
  FontColorsOutlined,
  ItalicOutlined,
  MinusOutlined,
  ProfileOutlined,
  PlusOutlined,
  UnderlineOutlined
} from '@ant-design/icons'
import { Button, Select } from 'antd'
import { useMemo, useState } from 'react'
import { styles } from '../styles'
import type { SlideElement } from '../parser'
import type { TextStyleAction, TextStyleState } from './text-style-commands'

interface ElementXmlPanelProps {
  element: SlideElement | null
  slideNumber: number
  xmlContent: string
  xmlError: string | null
  isSlideXml: boolean
  onXmlChange?: (value: string) => void
  onClearSelection?: () => void
  textStyleState?: TextStyleState | null
  onTextStyleAction?: (action: TextStyleAction) => void
}

type MainPanelTab = 'properties' | 'raw'
type PropertyTab = 'text'

const fontFamilyOptions = [
  'Arial',
  'Microsoft YaHei',
  'PingFang SC',
  'SimSun',
  'SimHei',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Courier New'
].map(fontFamily => ({ label: fontFamily, value: fontFamily }))

const fontSizeOptions = [
  10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72
].map(size => ({
  label: String(size),
  value: size
}))

const colorOptions = [
  '#000000', '#f5222d', '#fa8c16', '#fadb14', '#52c41a', '#13c2c2', '#1677ff', '#722ed1'
].map(color => ({ label: color.toUpperCase(), value: color }))

export function ElementXmlPanel({
  element,
  slideNumber,
  xmlContent,
  xmlError,
  isSlideXml,
  onXmlChange,
  onClearSelection,
  textStyleState,
  onTextStyleAction
}: ElementXmlPanelProps) {
  const [mainTab, setMainTab] = useState<MainPanelTab>('properties')
  const [propertyTab, setPropertyTab] = useState<PropertyTab>('text')
  const isTextElementSelected = element?.type === 'text'

  const resolvedFontFamily = textStyleState?.fontFamily || 'Arial'
  const resolvedFontSize = textStyleState?.fontSize || 16
  const resolvedColor = textStyleState?.color || '#000000'

  const rawMeta = useMemo(() => {
    if (isSlideXml) {
      return {
        title: `第 ${slideNumber} 页 · 页面 XML`,
        lines: ['范围: 当前页面完整 XML', '状态: 仅展示']
      }
    }
    return {
      title: `第 ${slideNumber} 页 · 元素 XML`,
      lines: [
        `ID: ${element?.id || '-'}`,
        `类型: ${element?.type || '-'}`,
        `状态: ${xmlError ? 'XML 解析失败（未同步）' : '实时同步中'}`
      ]
    }
  }, [element, isSlideXml, slideNumber, xmlError])

  return (
    <div style={styles.elementXmlPanel}>
      <div style={styles.elementXmlPanelTabContent}>
        <div style={styles.elementXmlPanelTabBody}>
          {mainTab === 'properties' && (
            <>
              <div style={styles.elementPropertyHeader}>属性</div>
              {isTextElementSelected ? (
                <>
                  <div style={styles.elementPropertySubTabBar}>
                    <button
                      type='button'
                      style={{
                        ...styles.elementPropertySubTabButton,
                        ...(propertyTab === 'text' ? styles.elementPropertySubTabButtonActive : {})
                      }}
                      onClick={() => setPropertyTab('text')}
                    >
                      文本
                    </button>
                  </div>
                  {propertyTab === 'text' && (
                    <div style={styles.elementPropertySection}>
                      <div style={styles.elementPropertySectionTitle}>字体</div>
                      <div style={styles.elementTextControlRow}>
                        <Select
                          value={resolvedFontFamily}
                          style={styles.elementTextControlFontSelect}
                          options={fontFamilyOptions}
                          onChange={value => {
                            onTextStyleAction?.({ type: 'set-font-family', value })
                          }}
                          disabled={!onTextStyleAction}
                        />
                        <Select
                          value={resolvedFontSize}
                          style={styles.elementTextControlSizeSelect}
                          options={fontSizeOptions}
                          onChange={value => {
                            onTextStyleAction?.({ type: 'set-font-size', value })
                          }}
                          disabled={!onTextStyleAction}
                        />
                        <div style={styles.elementTextControlSizeAdjustGroup}>
                          <Button
                            size='small'
                            style={styles.elementTextIconButton}
                            icon={<PlusOutlined />}
                            onClick={() => {
                              onTextStyleAction?.({ type: 'adjust-font-size', value: 2 })
                            }}
                            disabled={!onTextStyleAction}
                          />
                          <Button
                            size='small'
                            style={styles.elementTextIconButton}
                            icon={<MinusOutlined />}
                            onClick={() => {
                              onTextStyleAction?.({ type: 'adjust-font-size', value: -2 })
                            }}
                            disabled={!onTextStyleAction}
                          />
                        </div>
                      </div>
                      <div style={styles.elementTextControlRow}>
                        <Select
                          value={resolvedColor}
                          style={styles.elementTextControlColorSelect}
                          options={colorOptions}
                          suffixIcon={<FontColorsOutlined />}
                          onChange={value => {
                            onTextStyleAction?.({ type: 'set-color', value })
                          }}
                          disabled={!onTextStyleAction}
                        />
                        <div style={styles.elementTextStyleGroup}>
                          <Button
                            style={{
                              ...styles.elementTextIconButton,
                              ...(textStyleState?.isBold ? styles.elementTextIconButtonActive : {})
                            }}
                            icon={<BoldOutlined />}
                            onClick={() => {
                              onTextStyleAction?.({ type: 'toggle-bold' })
                            }}
                            disabled={!onTextStyleAction}
                          />
                          <Button
                            style={{
                              ...styles.elementTextIconButton,
                              ...(textStyleState?.isItalic ? styles.elementTextIconButtonActive : {})
                            }}
                            icon={<ItalicOutlined />}
                            onClick={() => {
                              onTextStyleAction?.({ type: 'toggle-italic' })
                            }}
                            disabled={!onTextStyleAction}
                          />
                          <Button
                            style={{
                              ...styles.elementTextIconButton,
                              ...(textStyleState?.isUnderline ? styles.elementTextIconButtonActive : {})
                            }}
                            icon={<UnderlineOutlined />}
                            onClick={() => {
                              onTextStyleAction?.({ type: 'toggle-underline' })
                            }}
                            disabled={!onTextStyleAction}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={styles.elementPropertyEmpty}>请先选中文本元素后再编辑属性</div>
              )}
            </>
          )}

          {mainTab === 'raw' && (
            <>
              <div style={styles.elementXmlPanelHeader}>
                <div style={styles.elementXmlPanelTitle}>{rawMeta.title}</div>
                {!isSlideXml && onClearSelection && (
                  <Button size='small' style={styles.elementXmlPanelCloseButton} onClick={onClearSelection}>
                    取消选中
                  </Button>
                )}
              </div>
              <div style={styles.elementXmlPanelMeta}>
                {rawMeta.lines.map(line => (
                  <span key={line}>{line}</span>
                ))}
              </div>
              {xmlError && (
                <div style={styles.elementXmlPanelError}>
                  {xmlError}
                </div>
              )}
              <div style={styles.elementXmlPanelEditor}>
                <Editor
                  key={isSlideXml ? `slide-${slideNumber}` : `element-${element?.id || 'unknown'}`}
                  language='xml'
                  height='100%'
                  value={xmlContent}
                  onChange={value => {
                    if (isSlideXml) return
                    onXmlChange?.(value || '')
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
            </>
          )}
        </div>

        <div style={styles.elementXmlPanelTabRail}>
          <Button
            size='small'
            style={{
              ...styles.elementXmlPanelTabButton,
              ...(mainTab === 'properties' ? styles.elementXmlPanelTabButtonActive : {})
            }}
            onClick={() => setMainTab('properties')}
          >
            <span style={styles.elementXmlPanelTabButtonInner}>
              <ProfileOutlined style={styles.elementXmlPanelTabButtonIcon} />
              <span style={styles.elementXmlPanelTabButtonLabel}>属性</span>
            </span>
          </Button>
          <Button
            size='small'
            style={{
              ...styles.elementXmlPanelTabButton,
              ...(mainTab === 'raw' ? styles.elementXmlPanelTabButtonActive : {})
            }}
            onClick={() => setMainTab('raw')}
          >
            <span style={styles.elementXmlPanelTabButtonInner}>
              <CodeOutlined style={styles.elementXmlPanelTabButtonIcon} />
              <span style={styles.elementXmlPanelTabButtonLabel}>Raw</span>
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
