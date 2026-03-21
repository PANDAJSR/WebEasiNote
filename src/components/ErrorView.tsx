import { Button } from 'antd'
import { styles } from '../styles'

interface ErrorViewProps {
  error: string
  onBack: () => void
}

export function ErrorView({ error, onBack }: ErrorViewProps) {
  return (
    <div style={styles.errorContainer}>
      <div style={styles.error}>
        <strong>❌ 错误</strong>
        <p>{error}</p>
        <Button danger onClick={onBack} style={styles.backButton}>
          ← 返回
        </Button>
      </div>
    </div>
  )
}
