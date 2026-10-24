import type { SlideData } from '../../types'
import { MatchingActivity } from './MatchingActivity'
import { QuestionActivity } from './QuestionActivity'
import { JudgeActivity } from './JudgeActivity'
import { CompetitionActivity } from './CompetitionActivity'

export function ActivityOverlays({ slide, resourceMap, scale }: {
  slide: SlideData; resourceMap: Record<string, string>; scale: number
}) {
  return <>{slide.activities?.filter(definition => definition.playable).map(definition =>
    definition.matching ? <MatchingActivity key={definition.id} definition={definition}
      elements={slide.elements} resourceMap={resourceMap} active width={slide.width} height={slide.height} scale={scale} />
      : definition.competition ? <CompetitionActivity key={definition.id} definition={definition}
        elements={slide.elements} resourceMap={resourceMap} active width={slide.width} height={slide.height} />
        : definition.key === 'Judge' && definition.questions ? <JudgeActivity key={definition.id} definition={definition}
          active width={slide.width} height={slide.height} resourceMap={resourceMap} />
          : definition.questions ? <QuestionActivity key={definition.id} definition={definition} active /> : null)}</>
}
