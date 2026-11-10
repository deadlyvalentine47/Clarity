// Caret coordinates inside a textarea, measured with a hidden mirror element.
// Used to anchor the slash-command menu to the cursor.

export interface CaretRect {
  left: number
  top: number
  height: number
}

const MIRROR_PROPERTIES = [
  'boxSizing',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'whiteSpace',
  'overflowWrap',
  'wordBreak',
  'direction',
]

const FALLBACK: CaretRect = { left: 0, top: 0, height: 20 }

export function caretRect(textarea: HTMLInputElement | HTMLTextAreaElement): CaretRect {
  try {
    const computed = window.getComputedStyle(textarea)
    const lineHeight =
      parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4 || FALLBACK.height
    const position = textarea.selectionStart ?? 0
    const isInput = textarea instanceof HTMLInputElement

    const mirror = document.createElement('div')
    mirror.setAttribute('aria-hidden', 'true')
    mirror.style.position = 'absolute'
    mirror.style.top = '0'
    mirror.style.left = '-9999px'
    mirror.style.visibility = 'hidden'
    mirror.style.pointerEvents = 'none'
    mirror.style.whiteSpace = isInput ? 'pre' : 'pre-wrap'
    mirror.style.overflowWrap = isInput ? 'normal' : 'break-word'
    mirror.style.overflow = 'hidden'
    mirror.style.width = `${textarea.clientWidth}px`

    for (const property of MIRROR_PROPERTIES) {
      mirror.style.setProperty(property, computed.getPropertyValue(property))
    }
    // Inputs never wrap; textareas copy their own wrapping from the computed
    // style, so restore the explicit values after the copy.
    mirror.style.whiteSpace = isInput ? 'pre' : 'pre-wrap'
    mirror.style.overflowWrap = isInput ? 'normal' : 'break-word'
    mirror.style.wordBreak = isInput ? 'normal' : 'break-word'

    mirror.textContent = textarea.value.slice(0, position)
    const marker = document.createElement('span')
    marker.textContent = textarea.value.slice(position) || '.'
    mirror.appendChild(marker)

    document.body.appendChild(mirror)
    const left = marker.offsetLeft - textarea.scrollLeft + textarea.clientLeft
    const top = marker.offsetTop - textarea.scrollTop + textarea.clientTop
    document.body.removeChild(mirror)

    return {
      left: Number.isFinite(left) ? Math.max(0, left) : FALLBACK.left,
      top: Number.isFinite(top) ? Math.max(0, top) : FALLBACK.top,
      height: lineHeight,
    }
  } catch {
    return FALLBACK
  }
}
