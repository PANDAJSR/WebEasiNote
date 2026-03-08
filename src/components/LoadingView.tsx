import { styles } from '../styles';

interface LoadingViewProps {
  message?: string;
}

export function LoadingView({ message = '正在解析课件...' }: LoadingViewProps) {
  return (
    <div style={styles.loadingContainer}>
      <div style={styles.spinner}></div>
      <p style={styles.loadingText}>{message}</p>
    </div>
  );
}
