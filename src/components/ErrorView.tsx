import { styles } from '../styles';

interface ErrorViewProps {
  error: string;
  onBack: () => void;
}

export function ErrorView({ error, onBack }: ErrorViewProps) {
  return (
    <div style={styles.errorContainer}>
      <div style={styles.error}>
        <strong>❌ 错误</strong>
        <p>{error}</p>
        <button onClick={onBack} style={styles.backButton}>
          ← 返回
        </button>
      </div>
    </div>
  );
}
