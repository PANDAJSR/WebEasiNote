import type { useActivityPlayback } from '../../viewer/activities/useActivityPlayback'
import { activityStyles as styles } from './styles'

export function ActivityControls({ playback, paused }: { playback: ReturnType<typeof useActivityPlayback>; paused: boolean }) {
  if (!playback.playable.length) return null
  return <div style={styles.controls} data-activity-control='true' data-prevent-swipe='true'
    onClick={event => event.stopPropagation()}>
    {playback.playable.map(definition => {
      const progress = playback.progress(definition)
      return <span key={definition.id}>
        <span role='status' aria-live='polite'>{paused ? '活动已暂停' : progress.accepted === progress.total
          ? '分类完成！' : `已分类 ${progress.accepted} / ${progress.total}`}</span>{' '}
        <button type='button' style={styles.reset} disabled={paused} onClick={() => playback.reset(definition)}>重新开始</button>
      </span>
    })}
    {playback.feedback && <span role='status' aria-live='polite'>{playback.feedback}</span>}
  </div>
}
