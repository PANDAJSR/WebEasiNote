import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
  },

  // 欢迎界面样式 - 简洁卡片
  welcomeContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px',
    backgroundColor: 'white',
    borderRadius: '8px',
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '1.75rem',
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '1rem',
    color: '#4a5568',
    marginBottom: '24px',
  },
  welcomeButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  fileButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.9375rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  folderButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: '#48bb78',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.9375rem',
    fontWeight: '500',
    cursor: 'pointer',
  },

  // 加载界面
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #667eea',
    borderRadius: '50%',
    marginBottom: '16px',
  },
  loadingText: {
    fontSize: '1rem',
    color: '#4a5568',
  },

  // 错误界面
  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    backgroundColor: '#f8f9fa',
  },
  error: {
    textAlign: 'center',
    color: '#c53030',
  },
  backButton: {
    marginTop: '16px',
    padding: '8px 16px',
    background: '#c53030',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },

  // 查看器主布局
  viewerContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8f9fa',
    overflow: 'hidden',
  },

  // 顶部工具栏 - 简洁
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    backgroundColor: 'white',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  coursewareName: {
    fontSize: '1rem',
    fontWeight: '500',
    color: '#1a202c',
  },
  slideInfo: {
    fontSize: '0.875rem',
    color: '#718096',
  },
  clearButton: {
    padding: '6px 12px',
    background: 'transparent',
    color: '#718096',
    border: 'none',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },

  // 主内容区
  mainContent: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },

  // 侧边栏 - 简洁
  sidebar: {
    width: '240px',
    minWidth: '240px',
    backgroundColor: 'white',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '12px 16px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },
  slideList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  slideTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
    flexShrink: 0,
  },
  slideTabActive: {
    backgroundColor: '#edf2f7',
  },
  slideTabNumber: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#4a5568',
  },
  slideTabInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  slideTabTitle: {
    fontSize: '0.875rem',
    color: '#1a202c',
  },
  slideTabSize: {
    fontSize: '0.75rem',
    color: '#a0aec0',
  },

  // 幻灯片查看器区域
  slideViewerContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  slideContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    overflow: 'auto',
    padding: '24px',
  },
  slideWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 底部信息栏 - 贴底
  slideInfoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    gap: '20px',
    padding: '8px 16px',
    backgroundColor: 'white',
    borderTop: '1px solid #e2e8f0',
    fontSize: '0.75rem',
    color: '#718096',
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  infoLabel: {
    color: '#a0aec0',
  },
  colorPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  colorBox: {
    width: '12px',
    height: '12px',
    borderRadius: '2px',
    border: '1px solid #e2e8f0',
  },
};
