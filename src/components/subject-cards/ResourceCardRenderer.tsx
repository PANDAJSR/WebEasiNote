import type { ResourceCardElement } from '../../types'
import { SubjectCardFrame } from './SubjectCardFrame'
import { resolvePronounceUrl } from './PronounceButton'
import { subjectStyles as styles } from './styles'

export function ResourceCardRenderer({ element, scale, resourceMap, active }: {
  element: ResourceCardElement; scale: number; resourceMap: Record<string, string>; active: boolean
}) {
  const image = resolvePronounceUrl(element.thumbnail, resourceMap)
  const url = /^https?:\/\//i.test(element.displayUrl) ? element.displayUrl : undefined
  const handleOpen = () => { if (active && url) window.open(url, '_blank', 'noopener,noreferrer') }
  const physical = element.kind === 'PhysicalGraph'
  const ai = element.kind === 'AIToolCard'
  return <SubjectCardFrame element={element} scale={scale} active={active} label={element.title || '物理图'}
    designWidth={physical ? element.width : element.layoutWidth} designHeight={physical ? element.height : element.layoutHeight}
    style={physical ? { background: 'transparent', boxShadow: 'none' } : ai ? { borderRadius: 16, boxShadow: 'none' } : undefined}>
    {physical ? <img src={image} alt="物理电路图" style={{ width: '100%', height: '100%', padding: 12, boxSizing: 'border-box', objectFit: 'contain' }} />
      : ai ? <div style={{ position: 'relative', width: 200, height: 200, border: '1px solid #1c1d1e1a', borderRadius: 16, overflow: 'hidden' }}>
        <img src={image} alt={element.subtitle} style={{ width: 200, height: 152, objectFit: 'cover' }} />
        <div style={{ height: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>
          {element.icon && <img src={resolvePronounceUrl(element.icon, resourceMap)} alt="" width="20" height="20" />}{element.title}
        </div>
        <button type="button" style={{ ...styles.icon, position: 'absolute', right: 16, bottom: 64, width: 48, height: 48 }}
          disabled={!active || !url} aria-label={`打开 ${element.title}`} onClick={handleOpen}>
          {element.buttonImage ? <img src={resolvePronounceUrl(element.buttonImage, resourceMap)} alt="" width="48" height="48" /> : '▶'}
        </button>
      </div> : <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 2 }}>
        {element.titleVisible && <div style={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderBottom: '1px solid #eceef3', padding: '0 15px', fontSize: 14 }} title={element.title}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{element.title}</span>
        </div>}
        {element.thumbnailVisible && <img src={image} alt="" style={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'cover' }} />}
        <button type="button" style={styles.accent} disabled={!active || !url} onClick={handleOpen}>{element.buttonContent}</button>
      </div>}
  </SubjectCardFrame>
}
