import { useState } from 'react'
import { styles } from '../styles'
import type { PagerPosition } from '../viewer-settings'

interface WelcomeViewProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFilePickerSelect: () => void
  onFolderSelect: () => void
  fileInputRef: React.RefObject<HTMLInputElement>
  supportsAutoReload: boolean
  autoReloadEnabled: boolean
  onAutoReloadChange: (enabled: boolean) => void
  clickToNextEnabled: boolean
  onClickToNextChange: (enabled: boolean) => void
  pagerPosition: PagerPosition
  onPagerPositionChange: (position: PagerPosition) => void
  showAnimationProgress: boolean
  onShowAnimationProgressChange: (enabled: boolean) => void
}

export function WelcomeView({
  onFileSelect,
  onFilePickerSelect,
  onFolderSelect,
  fileInputRef,
  supportsAutoReload,
  autoReloadEnabled,
  onAutoReloadChange,
  clickToNextEnabled,
  onClickToNextChange,
  pagerPosition,
  onPagerPositionChange,
  showAnimationProgress,
  onShowAnimationProgressChange
}: WelcomeViewProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <div style={styles.welcomeContainer}>
      <div style={styles.welcomeTopActions}>
        <button style={styles.settingsButton} onClick={() => setIsSettingsOpen(true)}>
          设置
        </button>
      </div>

      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📎</div>
        <h2 style={styles.emptyTitle}>希沃白板课件查看器</h2>
        <p style={styles.emptyText}>请选择 ENBX 文件或已解压的课件文件夹</p>
        <p style={styles.emptyHint}>支持格式：.enbx 文件，或包含 Board.xml 的文件夹</p>

        <input
          ref={fileInputRef}
          type='file'
          accept='.enbx'
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />

        <div style={styles.welcomeButtons}>
          <button onClick={onFilePickerSelect} style={styles.fileButton}>
            {supportsAutoReload && autoReloadEnabled
              ? '选择 ENBX 文件（自动重载）'
              : '选择 ENBX 文件'}
          </button>

          <button onClick={onFolderSelect} style={styles.folderButton}>
            选择已解压文件夹
          </button>
        </div>
      </div>

      {isSettingsOpen && (
        <div style={styles.settingsOverlay} onClick={() => setIsSettingsOpen(false)}>
          <div style={styles.settingsModal} onClick={event => event.stopPropagation()}>
            <div style={styles.settingsHeader}>
              <div style={styles.settingsTitle}>设置</div>
              <button style={styles.settingsCloseButton} onClick={() => setIsSettingsOpen(false)}>
                关闭
              </button>
            </div>

            <div style={styles.settingsBody}>
              <label style={styles.settingsRow}>
                <div style={styles.settingsLabelGroup}>
                  <div style={styles.settingsLabel}>自动重载 ENBX</div>
                  <div style={styles.settingsDescription}>
                    {supportsAutoReload
                      ? '检测到文件变化后自动刷新内容'
                      : '当前浏览器不支持该功能'}
                  </div>
                </div>
                <input
                  type='checkbox'
                  checked={autoReloadEnabled}
                  disabled={!supportsAutoReload}
                  onChange={event => onAutoReloadChange(event.target.checked)}
                  style={styles.settingsToggle}
                />
              </label>
              <label style={styles.settingsRow}>
                <div style={styles.settingsLabelGroup}>
                  <div style={styles.settingsLabel}>单击背景翻页</div>
                  <div style={styles.settingsDescription}>
                    仅在单击幻灯片背景时触发下一页
                  </div>
                </div>
                <input
                  type='checkbox'
                  checked={clickToNextEnabled}
                  onChange={event => onClickToNextChange(event.target.checked)}
                  style={styles.settingsToggle}
                />
              </label>
              <label style={styles.settingsRow}>
                <div style={styles.settingsLabelGroup}>
                  <div style={styles.settingsLabel}>页码下方显示动画进度</div>
                  <div style={styles.settingsDescription}>
                    仅当前页存在点击动画时显示进度
                  </div>
                </div>
                <input
                  type='checkbox'
                  checked={showAnimationProgress}
                  onChange={event => onShowAnimationProgressChange(event.target.checked)}
                  style={styles.settingsToggle}
                />
              </label>
              <div style={styles.settingsRow}>
                <div style={styles.settingsLabelGroup}>
                  <div style={styles.settingsLabel}>翻页键和页码位置</div>
                  <div style={styles.settingsDescription}>
                    选择左下角、右下角或两边同时显示
                  </div>
                </div>
                <div style={styles.settingsChoiceGroup}>
                  <button
                    type='button'
                    style={{
                      ...styles.settingsChoiceButton,
                      ...(pagerPosition === 'left' ? styles.settingsChoiceButtonActive : {})
                    }}
                    onClick={() => onPagerPositionChange('left')}
                  >
                    左下角
                  </button>
                  <button
                    type='button'
                    style={{
                      ...styles.settingsChoiceButton,
                      ...(pagerPosition === 'right' ? styles.settingsChoiceButtonActive : {})
                    }}
                    onClick={() => onPagerPositionChange('right')}
                  >
                    右下角
                  </button>
                  <button
                    type='button'
                    style={{
                      ...styles.settingsChoiceButton,
                      ...(pagerPosition === 'both' ? styles.settingsChoiceButtonActive : {})
                    }}
                    onClick={() => onPagerPositionChange('both')}
                  >
                    两边都有
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
