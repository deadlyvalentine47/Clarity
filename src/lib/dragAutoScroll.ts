import { useEffect } from 'react'

const EDGE_FRACTION = 0.18
const MAX_SPEED = 22

/**
 * Scroll the page while a manual drag-and-drop reorder is active.
 * Browsers do not auto-scroll the document for HTML5 drag events, so the
 * pointer position near the top/bottom edge has to drive scrolling ourselves.
 */
export function useDragAutoScroll(active: boolean): void {
  useEffect(() => {
    if (!active) return

    let velocity = 0
    let frame = 0

    const onDragOver = (event: DragEvent) => {
      const height = window.innerHeight
      const edge = Math.max(80, Math.min(160, height * EDGE_FRACTION))
      const y = event.clientY
      if (y < edge) {
        velocity = -Math.ceil(((edge - y) / edge) * MAX_SPEED)
      } else if (y > height - edge) {
        velocity = Math.ceil(((y - (height - edge)) / edge) * MAX_SPEED)
      } else {
        velocity = 0
      }
    }

    const tick = () => {
      if (velocity !== 0) window.scrollBy(0, velocity)
      frame = requestAnimationFrame(tick)
    }

    window.addEventListener('dragover', onDragOver, true)
    frame = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('dragover', onDragOver, true)
      cancelAnimationFrame(frame)
    }
  }, [active])
}
