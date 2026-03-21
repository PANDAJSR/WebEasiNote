import type { CSSProperties } from 'react'

export const viewerStyles: Record<string, CSSProperties> = {
  viewerContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8f9fa',
    overflow: 'hidden'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    backgroundColor: 'white',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  coursewareName: {
    fontSize: '1rem',
    fontWeight: '500',
    color: '#1a202c'
  },
  slideInfo: {
    fontSize: '0.875rem',
    color: '#718096'
  },
  clearButton: {
    padding: '6px 12px',
    background: 'transparent',
    color: '#718096',
    border: 'none',
    fontSize: '0.875rem',
    cursor: 'pointer'
  },
  issueButton: {
    padding: '6px 12px',
    background: '#edf2f7',
    color: '#2d3748',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    fontSize: '0.875rem',
    cursor: 'pointer'
  },
  modeToggleButton: {
    padding: '6px 12px',
    background: '#ebf8ff',
    color: '#2b6cb0',
    border: '1px solid #bee3f8',
    borderRadius: '4px',
    fontSize: '0.875rem',
    cursor: 'pointer'
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  },
  slideCanvasArea: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden'
  },
  editCanvasLayout: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    overflow: 'hidden'
  },
  slideCanvasViewport: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  sidebar: {
    width: '240px',
    minWidth: '240px',
    backgroundColor: 'white',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  sidebarHeader: {
    padding: '12px 16px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    flexShrink: 0
  },
  slideList: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  slideTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    width: '100%',
    height: 'auto',
    minHeight: '76px',
    whiteSpace: 'normal',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
    flexShrink: 0
  },
  slideTabActive: {
    backgroundColor: '#edf2f7'
  },
  slideTabStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '6px'
  },
  slideTabMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
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
    color: '#4a5568'
  },
  slideTabInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1
  },
  slideTabTitle: {
    fontSize: '0.875rem',
    color: '#1a202c'
  },
  slideTabSize: {
    fontSize: '0.75rem',
    color: '#a0aec0'
  },
  slideTabPreviewWrapper: {
    marginTop: 0,
    padding: 0,
    borderRadius: 0,
    backgroundColor: 'transparent'
  },
  slideTabPreviewViewport: {
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: '0',
    backgroundColor: 'transparent'
  },
  slideTabPreviewContent: {
    pointerEvents: 'none'
  },
  slideTabPreviewImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    display: 'block'
  },
  slideViewerContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative'
  },
  slideContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    overflow: 'auto',
    padding: 0
  },
  slideWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  slideViewport: {
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: '#000000'
  },
  slideWhiteBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#ffffff',
    pointerEvents: 'none'
  },
  slideLayerContainer: {
    position: 'relative',
    width: '100%',
    height: '100%'
  },
  elementXmlPanel: {
    width: '420px',
    minWidth: '320px',
    maxWidth: '50vw',
    height: '100%',
    flexShrink: 0,
    backgroundColor: '#ffffff',
    borderLeft: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  elementXmlPanelTabContent: {
    flex: 1,
    display: 'flex',
    minHeight: 0
  },
  elementXmlPanelTabBody: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column'
  },
  elementXmlPanelTabRail: {
    width: '64px',
    borderLeft: '1px solid #e5e7eb',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '10px',
    flexShrink: 0
  },
  elementXmlPanelTabButton: {
    width: '44px',
    minWidth: '44px',
    height: '44px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    fontSize: '0.8rem',
    fontWeight: '600',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  elementXmlPanelTabButtonActive: {
    border: '1px solid #93c5fd',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8'
  },
  elementXmlPanelHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px'
  },
  elementXmlPanelTitle: {
    color: '#1f2937',
    fontSize: '0.875rem',
    fontWeight: '600'
  },
  elementXmlPanelCloseButton: {
    padding: '4px 10px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem'
  },
  elementXmlPanelMeta: {
    padding: '8px 14px',
    color: '#6b7280',
    fontSize: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    borderBottom: '1px solid #e5e7eb'
  },
  elementXmlPanelError: {
    padding: '8px 14px',
    color: '#b91c1c',
    fontSize: '0.75rem',
    backgroundColor: '#fee2e2',
    borderBottom: '1px solid #fecaca'
  },
  elementXmlPanelEditor: {
    flex: 1,
    minHeight: 0
  }
}
