/** 官方 PictureRahmenType 枚举，同时兼容旧版别名。 */
export const PICTURE_FRAME_TYPES = ['None', 'RectFrame', 'RoundRectFrame', 'EllipseFrame', 'CurveRhombusFrame',
  'RectOverlapFrame', 'StampPhotoFrame', 'FlowerPhotoFrame', 'ArrowPhotoFrame', 'CrossPhotoFrame',
  'FrameInnerShadowAround', 'FrameShadowBottom', 'NormalFrame', 'DotDashFrame', 'LongDashFrame'] as const

const names: Record<string, string> = { '-1': 'empty', ellipse: 'ellipseframe', roundrect: 'roundrectframe' }
PICTURE_FRAME_TYPES.forEach((name, i) => { names[String(i < 12 ? i : i + 88)] = name.toLowerCase() })

export function normalizePictureFrameType(value?: string | number) {
  const key = String(value ?? '').trim().toLowerCase()
  return names[key] || key
}

export function isKnownPictureFrameType(value: string) {
  const type = normalizePictureFrameType(value)
  return type === 'empty' || PICTURE_FRAME_TYPES.some(name => name.toLowerCase() === type)
}
