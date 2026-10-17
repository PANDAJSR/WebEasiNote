export type PagerPosition = 'left' | 'right' | 'both'

export const DEFAULT_PAGER_POSITION: PagerPosition = 'right'
export const PAGER_POSITION_STORAGE_KEY = 'webeasinote:pagerPosition'
export const SHOW_ANIMATION_PROGRESS_STORAGE_KEY = 'webeasinote:showAnimationProgress'
export const SWIPE_NAVIGATION_STORAGE_KEY = 'webeasinote:swipeNavigationEnabled'

export function isPagerPosition(value: string | null): value is PagerPosition {
  return value === 'left' || value === 'right' || value === 'both'
}
