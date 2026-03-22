import type { CSSProperties } from 'react'

export const elementPanelStyles: Record<string, CSSProperties> = {
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '8px',
    paddingTop: '10px',
    flexShrink: 0
  },
  elementXmlPanelTabButton: {
    width: '52px',
    minWidth: '52px',
    height: '52px',
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
  elementXmlPanelTabButtonInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1px',
    lineHeight: 1
  },
  elementXmlPanelTabButtonIcon: {
    fontSize: '0.95rem'
  },
  elementXmlPanelTabButtonLabel: {
    fontSize: '0.7rem',
    fontWeight: '600',
    letterSpacing: '0.2px'
  },
  elementXmlPanelTabButtonActive: {
    border: '1px solid #18a058',
    backgroundColor: '#ecfdf3',
    color: '#047857'
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
  },
  elementPropertySubTabBar: {
    display: 'flex',
    gap: '14px',
    padding: '10px 18px 0',
    borderBottom: '1px solid #eef2f7'
  },
  elementPropertySubTabButton: {
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#6b7280',
    fontSize: '1rem',
    fontWeight: '600',
    lineHeight: 1.4,
    padding: '8px 2px'
  },
  elementPropertySubTabButtonActive: {
    color: '#111827',
    borderBottom: '2px solid #111827'
  },
  elementPropertySection: {
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  elementPropertySectionTitle: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '4px'
  },
  elementTextControlRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start'
  },
  elementTextControlFontSelect: {
    flex: 1
  },
  elementTextControlSizeSelect: {
    width: '124px'
  },
  elementTextControlSizeAdjustGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  elementTextControlColorSelect: {
    width: '124px'
  },
  elementTextStyleGroup: {
    display: 'flex',
    flex: 1
  },
  elementTextIconButton: {
    minWidth: '44px',
    height: '42px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    color: '#111827',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  elementTextIconButtonActive: {
    border: '1px solid #18a058',
    backgroundColor: '#ecfdf3',
    color: '#047857'
  },
  elementPropertyEmpty: {
    padding: '18px',
    fontSize: '0.875rem',
    color: '#6b7280'
  }
}
