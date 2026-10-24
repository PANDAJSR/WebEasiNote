import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { ViewElement } from '../../types/view'
import { executeViewLink } from './view-actions'

export const ViewInteraction = createContext<((uri: string) => void) | null>(null)

export function ViewInteractionRoot({ element, onFront, children }: {
  element: ViewElement
  onFront?: (id: string) => void
  children: (view: ViewElement) => ReactNode
}) {
  const [state, setState] = useState({ source: element, view: element })
  if (state.source !== element) setState({ source: element, view: element })
  const view = state.source === element ? state.view : element
  const execute = (uri: string) => {
    const next = executeViewLink(view, uri)
    setState({ source: element, view: next.root })
    if (next.front) onFront?.(element.id)
  }
  return <ViewInteraction.Provider value={execute}>{children(view)}</ViewInteraction.Provider>
}

export const useViewInteraction = () => useContext(ViewInteraction)
