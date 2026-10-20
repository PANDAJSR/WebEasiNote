import { useRef, useState } from 'react'
import type { SolarSystemElement } from '../../types'
import { SubjectCardFrame } from './SubjectCardFrame'
import { GlobeCanvas } from './GlobeCanvas'
import { resolvePronounceUrl } from './PronounceButton'
import { scienceStyles as styles } from './science-styles'

const mapNames: Record<string, string> = { Satellite: '卫星影像', Plate: '板块', Rainfall: '降水', Temperature: '气温',
  Climate: '气候', Population: '人口', OceanCurrent: '洋流', Natural: '自然带', Isobar1: '一月等压线', Isobar7: '七月等压线' }
export function SolarSystemRenderer({ element, scale, resourceMap, active }: {
  element: SolarSystemElement; scale: number; resourceMap: Record<string, string>; active: boolean
}) {
  const [map, setMap] = useState(element.textureKey)
  const [flat, setFlat] = useState(element.view === 'TwoD')
  const [rotation, setRotation] = useState([0, 0])
  const [zoom, setZoom] = useState(1)
  const [mapsOpen, setMapsOpen] = useState(false)
  const drag = useRef<number[] | null>(null)
  const cameraDistance = Math.max(1.05, Math.hypot(...element.cameraPosition) / zoom)
  const longitude = Math.atan2(element.cameraPosition[1], element.cameraPosition[0]) + rotation[0]
  const latitude = Math.max(-1.48, Math.min(1.48, Math.asin(element.cameraPosition[2] / (Math.hypot(...element.cameraPosition) || 9)) + rotation[1]))
  const camera = [Math.cos(longitude) * Math.cos(latitude), Math.sin(longitude) * Math.cos(latitude), Math.sin(latitude)].map(n => n * cameraDistance)
  const look = rotation[0] || rotation[1] ? camera.map(n => -n) : element.cameraLook
  const source = resolvePronounceUrl((flat ? element.maps[map] : element.textures[map]) || element.textures[map], resourceMap)
  const moon = resolvePronounceUrl(element.textures.Moon || '', resourceMap)
  const diameter = element.width / Math.tan(Math.PI / 8) / Math.sqrt(cameraDistance ** 2 - 1)
  const handleReset = () => { setRotation([0, 0]); setZoom(1); setMap(element.textureKey); setFlat(element.view === 'TwoD') }
  return <SubjectCardFrame element={element} scale={scale} active={active} label="地球仪"
    style={{ background: '#07152c44', borderRadius: 0, boxShadow: 'none', overflow: 'hidden', color: '#ffffff' }}>
    {element.system !== 'Earth' ? <div role="status">暂不支持此星体系统：{element.system}</div> : <>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: active ? 'grab' : undefined, touchAction: 'none' }}
        onPointerDown={event => { if (active && !flat) { drag.current = [event.clientX, event.clientY, ...rotation]; event.currentTarget.setPointerCapture(event.pointerId) } }}
        onPointerMove={event => { if (active && drag.current) setRotation([drag.current[2] - (event.clientX - drag.current[0]) / (scale * 180), drag.current[3] + (event.clientY - drag.current[1]) / (scale * 180)]) }}
        onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
        {flat ? <img src={source} alt={mapNames[map] || map} style={{ maxWidth: '90%', maxHeight: '75%', objectFit: 'contain', transform: `scale(${zoom})` }} />
          : <GlobeCanvas source={source} camera={camera} up={element.cameraUp} look={look} diameter={diameter} />}
      </div>
      {!flat && <div aria-label="月球轨道" style={{ position: 'absolute', left: 0, right: 0, top: '12%', height: 30, pointerEvents: 'none' }}>
        <svg width="100%" height="10"><path d={`M0 3Q${element.width / 2} -5 ${element.width} 3`} fill="none" stroke="#a5afbd" strokeWidth=".6" strokeDasharray="50 55 60 65 88 138 240 138 88 65" /></svg>
        <div style={{ position: 'absolute', left: '60.7%', top: -6, textAlign: 'center' }}>
          {moon && <img src={moon} alt="" width="13" height="13" style={{ borderRadius: '50%', objectFit: 'cover' }} />}<div style={{ fontSize: 14, marginTop: 8 }}>月球</div>
        </div>
      </div>}
      <div style={{ position: 'absolute', right: 21, bottom: 80, display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" disabled={!active} style={styles.button} aria-label="选择地球地图" aria-expanded={mapsOpen} onClick={() => setMapsOpen(value => !value)}>◎ 地图</button>
        <button type="button" disabled={!active} style={styles.button} onClick={() => setFlat(value => !value)} aria-label={flat ? '切换三维地球' : '切换二维地图'}>⇆ {flat ? '三维' : '二维'}</button>
        <div style={{ display: 'flex' }}><button type="button" style={styles.zoom} disabled={!active} aria-label="放大地球" onClick={() => setZoom(value => Math.min(3, value * 1.2))}>＋</button>
          <button type="button" style={styles.zoom} disabled={!active} aria-label="缩小地球" onClick={() => setZoom(value => Math.max(.5, value / 1.2))}>−</button></div>
        <button type="button" style={styles.reset} disabled={!active} aria-label="复位地球仪" onClick={handleReset}>↻</button>
        {mapsOpen && <div style={styles.maps} role="group" aria-label="地球地图">
          {Object.keys(element.maps).map(key => <button key={key} type="button" disabled={!active} aria-pressed={key === map}
            style={{ ...styles.button, width: '100%', color: key === map ? '#00c881' : '#ffffff' }} onClick={() => { setMap(key); setMapsOpen(false) }}>{mapNames[key] || key}</button>)}
        </div>}
      </div>
    </>}
  </SubjectCardFrame>
}
