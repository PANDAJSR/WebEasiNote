import type { CSSProperties } from 'react'
import { baseStyles } from './styles/base-styles'
import { elementPanelStyles } from './styles/element-panel-styles'
import { welcomeStyles } from './styles/welcome-styles'
import { viewerStyles } from './styles/viewer-styles'
import { overlayStyles } from './styles/overlay-styles'

export const styles: Record<string, CSSProperties> = {
  ...baseStyles,
  ...welcomeStyles,
  ...viewerStyles,
  ...elementPanelStyles,
  ...overlayStyles
}
