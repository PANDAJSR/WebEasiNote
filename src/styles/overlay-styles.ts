import type { CSSProperties } from 'react'

export const overlayStyles: Record<string, CSSProperties> = {
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000
  },
  modalCard: {
    width: 'min(920px, 100%)',
    maxHeight: 'min(80vh, 760px)',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0'
  },
  modalTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1a202c'
  },
  modalCloseButton: {
    padding: '6px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    background: '#ffffff',
    color: '#4a5568',
    cursor: 'pointer',
    fontSize: '0.875rem'
  },
  modalSummary: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    padding: '12px 20px',
    borderBottom: '1px solid #edf2f7',
    backgroundColor: '#f8fafc',
    color: '#475569',
    fontSize: '0.875rem'
  },
  issueFilterBar: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    padding: '10px 20px',
    borderBottom: '1px solid #edf2f7',
    backgroundColor: '#ffffff'
  },
  issueFilterButton: {
    padding: '4px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontSize: '0.75rem',
    cursor: 'pointer'
  },
  issueFilterButtonActive: {
    backgroundColor: '#e2e8f0',
    color: '#1e293b',
    borderColor: '#94a3b8'
  },
  modalEmpty: {
    padding: '28px 20px',
    color: '#64748b',
    fontSize: '0.9375rem'
  },
  issueList: {
    overflowY: 'auto',
    padding: '12px 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  issueItem: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  issueItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  issueBadge: {
    fontSize: '0.75rem',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '999px',
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    border: '1px solid #fed7aa'
  },
  issueMeta: {
    fontSize: '0.75rem',
    color: '#64748b'
  },
  issueName: {
    fontSize: '0.875rem',
    color: '#1e293b',
    fontWeight: '500'
  },
  issueValue: {
    fontSize: '0.8125rem',
    color: '#475569',
    lineHeight: 1.4,
    wordBreak: 'break-all'
  },
  floatingPagerContainer: {
    position: 'absolute',
    bottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    zIndex: 25
  },
  floatingPagerContainerLeft: {
    left: '16px'
  },
  floatingPagerContainerRight: {
    right: '16px'
  },
  floatingPagerActionButton: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    border: 'none',
    borderRadius: '10px',
    backgroundColor: 'rgba(248, 250, 252, 0.72)',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.16)',
    color: '#334155',
    cursor: 'pointer'
  },
  floatingPagerActionButtonDisabled: {
    backgroundColor: 'rgba(226, 232, 240, 0.72)',
    color: '#94a3b8',
    cursor: 'not-allowed'
  },
  floatingPagerActionIcon: {
    fontSize: '1.35rem'
  },
  floatingPagerPageButton: {
    minWidth: '76px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 10px',
    border: 'none',
    borderRadius: '10px',
    backgroundColor: 'rgba(248, 250, 252, 0.72)',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.16)',
    color: '#334155',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  floatingPagerPageButtonWithProgress: {
    minWidth: '118px',
    height: '44px',
    padding: '0 10px'
  },
  floatingPagerPageContent: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px'
  },
  floatingPagerValue: {
    fontSize: '1.25rem',
    lineHeight: 1,
    letterSpacing: '0.3px',
    fontWeight: 600,
    color: '#475569'
  },
  floatingPagerAnimationProgressWrap: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px'
  },
  floatingPagerAnimationProgressText: {
    fontSize: '0.6875rem',
    lineHeight: 1,
    color: '#475569'
  },
  slidePanelOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    zIndex: 15,
    transition: 'opacity 180ms ease'
  },
  slidePanelOverlayVisible: {
    opacity: 1,
    pointerEvents: 'auto'
  },
  slidePanelOverlayHidden: {
    opacity: 0,
    pointerEvents: 'none'
  },
  slideFloatingPanel: {
    position: 'absolute',
    top: '16px',
    bottom: '68px',
    width: '200px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(4px)',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 14px 28px rgba(15, 23, 42, 0.16)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 20,
    transition: 'opacity 180ms ease, transform 180ms ease'
  },
  slideFloatingPanelVisible: {
    opacity: 1,
    pointerEvents: 'auto'
  },
  slideFloatingPanelHidden: {
    opacity: 0,
    pointerEvents: 'none'
  },
  slideFloatingPanelLeft: {
    left: '16px',
    transform: 'translateX(0)'
  },
  slideFloatingPanelLeftHidden: {
    left: '16px',
    transform: 'translateX(-12px)'
  },
  slideFloatingPanelRight: {
    right: '16px',
    transform: 'translateX(0)'
  },
  slideFloatingPanelRightHidden: {
    right: '16px',
    transform: 'translateX(12px)'
  }
}
