import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
  type SyntheticEvent,
  type TextareaHTMLAttributes,
} from 'react'
import { SlashMenu } from './SlashMenu'
import MarkdownPreview from './MarkdownPreview'
import { caretRect } from '../lib/caretRect'
import { filterCommands, TEXT_COMMANDS, type SlashCommand } from '../lib/slashCommands'

export type TextAreaSize = 'sm' | 'md' | 'lg'

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string
  onValueChange: (next: string) => void
  /** Minimum height token. Default `md` (120px). */
  size?: TextAreaSize
  /** Grow with the content up to `maxHeight`. Default true. */
  autoGrow?: boolean
  maxHeight?: string
  /** Render a live markdown view below the field. Default `none`. */
  preview?: 'none' | 'below'
  /** Let rendered checkboxes/radios rewrite the text. Default true. */
  interactivePreview?: boolean
  /** Slash commands. Defaults to the shared text set; pass `false` to disable. */
  commands?: readonly SlashCommand[] | false
  /** Handles commands with an `actionId` (for example the image picker). */
  onCommand?: (id: string) => void
  ref?: Ref<HTMLTextAreaElement>
}

const SIZE_MIN_HEIGHT: Record<TextAreaSize, number> = { sm: 80, md: 120, lg: 160 }
const MENU_WIDTH = 260
const TASK_LINE = /^([ \t]*)- \[[ xX]\] (.*)$/
const SLASH_LINE = /^([ \t]*)\/([a-z0-9]*)$/i

interface MenuState {
  /** Index of the `/` in the source value. */
  slash: number
  query: string
  style: CSSProperties
}

function menuStyleFor(textarea: HTMLTextAreaElement): CSSProperties {
  const rect = caretRect(textarea)
  const width = Math.min(MENU_WIDTH, Math.max(180, textarea.clientWidth))
  let left = rect.left
  if (left + width > textarea.clientWidth) left = Math.max(0, textarea.clientWidth - width)
  return { left, top: rect.top + rect.height + 2, width }
}

export function TextArea({
  value,
  onValueChange,
  size = 'md',
  autoGrow = true,
  maxHeight = '55vh',
  preview = 'none',
  interactivePreview = true,
  commands = TEXT_COMMANDS,
  onCommand,
  className,
  style,
  ref,
  onKeyDown,
  onSelect,
  ...rest
}: TextAreaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [active, setActive] = useState(0)

  const assignRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as { current: HTMLTextAreaElement | null }).current = node
    },
    [ref],
  )

  const available = useMemo(
    () =>
      commands === false
        ? []
        : commands.filter((command) => !command.actionId || onCommand != null),
    [commands, onCommand],
  )

  const items = useMemo(
    () => (menu ? filterCommands(available, menu.query) : []),
    [menu, available],
  )

  const syncMenu = useCallback(
    (textarea: HTMLTextAreaElement) => {
      if (available.length === 0) {
        setMenu(null)
        return
      }
      const position = textarea.selectionStart ?? 0
      if (position !== (textarea.selectionEnd ?? position)) {
        setMenu(null)
        return
      }
      const before = textarea.value.slice(0, position)
      const lineStart = before.lastIndexOf('\n') + 1
      const match = SLASH_LINE.exec(before.slice(lineStart))
      if (!match) {
        setMenu(null)
        return
      }
      setMenu({
        slash: lineStart + match[1].length,
        query: match[2],
        style: menuStyleFor(textarea),
      })
      setActive(0)
    },
    [available.length],
  )

  useEffect(() => {
    if (!autoGrow) return
    const node = innerRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }, [value, autoGrow])

  const applyCommand = useCallback(
    (command: SlashCommand) => {
      const node = innerRef.current
      if (!node || !menu) return
      setMenu(null)
      setActive(0)

      if (command.actionId) {
        onCommand?.(command.actionId)
        return
      }

      const insert = typeof command.insert === 'function' ? command.insert() : command.insert
      if (insert === '') return
      const caret = node.selectionStart ?? 0
      const before = node.value.slice(0, menu.slash)
      const after = node.value.slice(caret)
      const suffix = insert.includes('\n') && after !== '' && !after.startsWith('\n') ? '\n' : ''
      const next = before + insert + suffix + after
      const cursor = before.length + insert.length - (command.caretOffset ?? 0)
      // Update the DOM before the React state so fast follow-up keystrokes land
      // on the new caret instead of racing the re-render.
      node.value = next
      node.focus()
      node.setSelectionRange(cursor, cursor)
      onValueChange(next)
    },
    [menu, onCommand, onValueChange],
  )

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onValueChange(event.target.value)
    syncMenu(event.target)
  }

  const handleSelect = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    onSelect?.(event)
    syncMenu(event.currentTarget)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (menu) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((index) => (items.length === 0 ? 0 : (index + 1) % items.length))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((index) =>
          items.length === 0 ? 0 : (index - 1 + items.length) % items.length,
        )
        return
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && items.length > 0) {
        event.preventDefault()
        applyCommand(items[Math.min(active, items.length - 1)])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setMenu(null)
        return
      }
      if (
        event.key === ' ' &&
        items.length === 1 &&
        items[0].id.toLowerCase() === menu.query.toLowerCase()
      ) {
        event.preventDefault()
        applyCommand(items[0])
        return
      }
    }

    if (!menu && event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const node = event.currentTarget
      const position = node.selectionStart ?? 0
      if (position === (node.selectionEnd ?? position)) {
        const before = node.value.slice(0, position)
        const lineStart = before.lastIndexOf('\n') + 1
        const lineEndIndex = node.value.indexOf('\n', position)
        const restOfLine = node.value.slice(position, lineEndIndex === -1 ? node.value.length : lineEndIndex)
        const task = TASK_LINE.exec(before.slice(lineStart))
        if (task && restOfLine === '') {
          event.preventDefault()
          if (task[2].trim() === '') {
            const next = node.value.slice(0, lineStart) + node.value.slice(position)
            node.value = next
            node.setSelectionRange(lineStart, lineStart)
            onValueChange(next)
          } else {
            const insertion = `\n${task[1]}- [ ] `
            const next = node.value.slice(0, position) + insertion + node.value.slice(position)
            const cursor = position + insertion.length
            node.value = next
            node.setSelectionRange(cursor, cursor)
            onValueChange(next)
          }
          return
        }
      }
    }

    onKeyDown?.(event)
  }

  const minHeight = style?.minHeight ?? SIZE_MIN_HEIGHT[size]

  return (
    <div className="ta">
      <textarea
        {...rest}
        ref={assignRef}
        className={`textarea${className ? ` ${className}` : ''}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        style={{ ...style, minHeight, maxHeight, overflowY: autoGrow ? 'auto' : style?.overflowY }}
        aria-expanded={menu != null}
      />
      {menu && (
        <SlashMenu
          items={items}
          activeIndex={active}
          onPick={applyCommand}
          onHover={setActive}
          style={menu.style}
        />
      )}
      {preview === 'below' && value.trim() !== '' && (
        <div className="ta-preview">
          <MarkdownPreview
            content={value}
            onChange={interactivePreview ? onValueChange : undefined}
          />
        </div>
      )}
    </div>
  )
}
