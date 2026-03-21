import type { CSSProperties } from 'react'

export const welcomeStyles: Record<string, CSSProperties> = {
  welcomeContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    background: 'linear-gradient(145deg, #f0f4f8 0%, #e6eef5 52%, #dbe6ef 100%)'
  },
  welcomeTopActions: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 3
  },
  settingsButton: {
    height: '36px',
    padding: '0 14px',
    borderRadius: '18px',
    border: '1px solid rgba(148, 163, 184, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    color: '#334155',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    backdropFilter: 'blur(6px)'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px',
    backgroundColor: 'white',
    borderRadius: '8px'
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '16px'
  },
  emptyTitle: {
    fontSize: '1.75rem',
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '1rem',
    color: '#4a5568',
    marginBottom: '24px'
  },
  emptyHint: {
    fontSize: '0.875rem',
    color: '#64748b',
    marginBottom: '24px'
  },
  welcomeButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
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
    cursor: 'pointer'
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
    cursor: 'pointer'
  },
  settingsOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000
  },
  settingsModal: {
    width: 'min(480px, 100%)',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
    overflow: 'hidden'
  },
  settingsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0'
  },
  settingsTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1a202c'
  },
  settingsCloseButton: {
    padding: '6px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    background: '#ffffff',
    color: '#4a5568',
    cursor: 'pointer',
    fontSize: '0.875rem'
  },
  settingsBody: {
    padding: '16px 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  settingsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px'
  },
  settingsLabelGroup: {
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  settingsLabel: {
    fontSize: '0.9375rem',
    fontWeight: '600',
    color: '#1e293b'
  },
  settingsDescription: {
    fontSize: '0.8125rem',
    color: '#64748b'
  },
  settingsToggle: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  settingsChoiceGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  settingsChoiceButton: {
    height: '30px',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  settingsChoiceButtonActive: {
    borderColor: '#667eea',
    backgroundColor: '#eef2ff',
    color: '#3730a3'
  }
}
