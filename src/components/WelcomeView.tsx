import { styles } from '../styles';

interface WelcomeViewProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFolderSelect: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export function WelcomeView({ onFileSelect, onFolderSelect, fileInputRef }: WelcomeViewProps) {
  return (
    <div style={styles.welcomeContainer}>
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📚</div>
        <h2 style={styles.emptyTitle}>希沃白板课件查看器</h2>
        <p style={styles.emptyText}>请选择 ENBX 文件或已解压的课件文件夹</p>
        <p style={styles.emptyHint}>
          支持格式：.enbx 文件 或 包含 Board.xml 的文件夹
        </p>
        
        <div style={styles.welcomeButtons}>
          <label style={styles.fileButton}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".enbx"
              onChange={onFileSelect}
              style={{ display: 'none' }}
            />
            📁 选择 ENBX 文件
          </label>

          <button onClick={onFolderSelect} style={styles.folderButton}>
            📂 选择已解压文件夹
          </button>
        </div>
      </div>
    </div>
  );
}
