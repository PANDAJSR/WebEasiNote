import { useLayoutEffect, useRef } from 'react'
import { competitionStyles as styles } from './competition-styles'

/** 依照官方横幅结构重绘几何，不打包安装目录中的专有位图。 */
export function CompetitionParchment({ tab = false }: { tab?: boolean }) {
  return <svg aria-hidden='true' viewBox={tab ? '0 0 794 212' : '0 0 794 520'} preserveAspectRatio='none' style={styles.parchment}>
    {tab && <path d='M220 115 L245 193 Q249 207 266 207 H528 Q545 207 549 193 L574 115Z' fill='#b77e36' stroke='#cd9347' strokeWidth='6' />}
    <path d={tab ? 'M12 5 Q397 -2 782 5 L776 118 Q400 128 18 118Z' : 'M14 5 Q397 -2 780 5 L770 504 Q397 525 24 504Z'}
      fill='#ffe394' stroke='#d6a84e' strokeWidth='8' strokeLinejoin='round' />
    <path d={tab ? 'M20 14 Q397 5 773 14 L768 108 Q397 118 26 108Z' : 'M25 18 Q397 7 768 18 L758 490 Q397 507 36 490Z'} fill='#ffe9a3' />
    <path d={tab ? 'M18 25 L31 36 L16 41 M778 55 L745 60 L777 64 M22 104 L51 108 L23 110' : 'M20 48 L40 65 L19 70 M777 170 L744 180 L775 185 M30 470 L68 480 L30 484'} fill='#eab95a' />
  </svg>
}

export function CompetitionEntrance({ children }: { children: React.ReactNode }) {
  const node = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const animation = node.current?.animate?.([{ transform: 'translateY(-1080px)' }, { transform: 'translateY(0)', offset: 1 / 3 },
      { transform: 'translateY(-20px)', offset: 2 / 3 }, { transform: 'translateY(0)' }], { duration: 450 })
    void animation?.finished?.catch(() => {})
    return () => animation?.cancel()
  }, [])
  return <div ref={node}>{children}</div>
}

export function CompetitionAction({ label, icon, disabled, onClick }: {
  label: string; icon: string; disabled?: boolean; onClick: () => void
}) {
  return <div><button type='button' aria-label={label} title={label} disabled={disabled} onClick={onClick}
    style={{ ...styles.round, opacity: disabled ? 0.5 : 1 }}><span aria-hidden='true'>{icon}</span></button>
    <span style={styles.actionLabel}>{label}</span></div>
}

export function CompetitionHeader({ title, leftScore, rightScore, pair, time, active, onPause }: {
  title: string; leftScore: number; rightScore: number; pair: number; time: string; active: boolean; onPause: () => void
}) {
  return <header style={styles.header} data-competition-header={pair}>
    {[leftScore, rightScore].map((score, index) => <div key={index} style={{ ...styles.score, [index ? 'right' : 'left']: 20 }}>
      <CompetitionParchment /><span style={styles.scoreLabel}>第{pair * 2 + index + 1}组</span>
      <span style={styles.scoreText} aria-label={`第 ${pair * 2 + index + 1} 组：${score} 分`}>{score}</span>
    </div>)}
    <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 794, height: 212 }}>
      <CompetitionParchment tab /><div style={styles.title}>{title}</div>
    </div>
    <span role='timer' style={{ ...styles.timer, color: time.startsWith('00:0') ? '#ffded2' : '#ffffff' }}>{time}</span>
    <button type='button' style={styles.pause} aria-label='暂停' title='暂停' disabled={!active} onClick={onPause}>Ⅱ</button>
  </header>
}
