/** 指针统一转换为页面设计坐标；捕获后允许指针移到画布之外。 */
export function pointerToSlide(point: { clientX: number; clientY: number },
  origin: { left: number; top: number }, scale: number) {
  return { x: (point.clientX - origin.left) / scale, y: (point.clientY - origin.top) / scale }
}
