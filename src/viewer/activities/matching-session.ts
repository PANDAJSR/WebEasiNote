import type { ActivityDefinition } from '../../types'
import type { MatchingCheckResult, MatchingPlacements } from './matching'

export interface MatchingSession {
  placements: MatchingPlacements
  selectedId: string | null
  checked: MatchingCheckResult | null
}
const sessions = new WeakMap<ActivityDefinition, MatchingSession>()
export function matchingSession(definition: ActivityDefinition) {
  let session = sessions.get(definition)
  if (!session) {
    session = { placements: {}, selectedId: null, checked: null }
    sessions.set(definition, session)
  }
  return session
}
