import { styles } from '../styles'

interface WelcomeViewProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFilePickerSelect: () => void
  onFolderSelect: () => void
  fileInputRef: React.RefObject<HTMLInputElement>
  supportsAutoReload: boolean
}

export function WelcomeView({
  onFileSelect,
  onFilePickerSelect,
  onFolderSelect,
  fileInputRef,
  supportsAutoReload
}: WelcomeViewProps) {
  return (
    <div style={styles.welcomeContainer}>
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
            {supportsAutoReload ? '📥 选择 ENBX 文件（自动重载）' : '📥 选择 ENBX 文件'}
          </button>

          <button onClick={onFolderSelect} style={styles.folderButton}>
            📂 选择已解压文件夹
          </button>
        </div>
      </div>
    </div>
  )
}
