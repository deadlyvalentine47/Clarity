import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from 'react'
import { Check } from 'lucide-react'
import { createPortal } from 'react-dom'
import { SlashMenu } from './SlashMenu'
import { NoteImage } from './NoteImage'
import { caretRect } from '../lib/caretRect'
import { filterCommands, TEXT_COMMANDS, type SlashCommand } from '../lib/slashCommands'
import {
  bulletLine,
  headingLine,
  insertLines,
  orderedLine,
  parseMarkdown,
  quoteLine,
  radioLine,
  removeLine,
  replaceLine,
  replaceLines,
  selectRadioLine,
  tableLines,
  taskLine,
  toggleTaskLine,
  type MdBlock,
} from '../lib/markdown'

export interface RichTextEditorHandle {
  focus: () => void
  /** Insert a new block (for example an image marker) after the active block. */
  insertBlock: (text: string) => void
}

export interface RichTextEditorProps {
  value: string
  onValueChange: (next: string) => void
  size?: 'sm' | 'md' | 'lg'
  minHeight?: number
  maxHeight?: string
  placeholder?: string
  commands?: readonly SlashCommand[] | false
  onCommand?: (id: string) => void
  id?: string
  autoFocus?: boolean
  disabled?: boolean
  onBlur?: () => void
  style?: CSSProperties
  className?: string
  ariaLabel?: string
  ref?: Ref<RichTextEditorHandle>
}

type Editable = HTMLInputElement | HTMLTextAreaElement

interface FocusTarget {
  key: string
  caret: 'start' | 'end' | number
}

interface MenuState {
  line: number
  query: string
  style: CSSProperties
}

interface ActiveBlock {
  line: number
  endLine: number
}

const SIZE_MIN_HEIGHT: Record<NonNullable<RichTextEditorProps['size']>, number> = {
  sm: 80,
  md: 120,
  lg: 160,
}
const SLASH_LINE = /^([ \t]*)\/([a-z0-9]*)$/i
const MENU_WIDTH = 260

function isInlineText(block: MdBlock): boolean {
  return (
    block.kind === 'paragraph' ||
    block.kind === 'heading' ||
    block.kind === 'bullet' ||
    block.kind === 'ordered' ||
    block.kind === 'task' ||
    block.kind === 'radio' ||
    block.kind === 'quote'
  )
}

function lineForBlock(block: MdBlock, text: string): string {
  switch (block.kind) {
    case 'heading':
      return headingLine(block.level, text)
    case 'bullet':
      return bulletLine(block.indent, block.marker, text)
    case 'ordered':
      return orderedLine(block.indent, block.number, text)
    case 'task':
      return taskLine(block.indent, block.marker, block.checked, text)
    case 'radio':
      return radioLine(block.indent, block.marker, block.checked, text)
    case 'quote':
      return quoteLine(text)
    default:
      return text
  }
}

function previousEditable(blocks: MdBlock[], line: number): MdBlock | null {
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i]
    if (block.line >= line) continue
    if (block.kind === 'hr' || block.kind === 'image') continue
    return block
  }
  return null
}

export function RichTextEditor({
  value,
  onValueChange,
  size = 'md',
  minHeight,
  maxHeight = '60vh',
  placeholder = "Type '/' for commands",
  commands = TEXT_COMMANDS,
  onCommand,
  id,
  autoFocus,
  disabled,
  onBlur,
  style,
  className,
  ariaLabel,
  ref,
}: RichTextEditorProps) {
  const blocks = useMemo(() => parseMarkdown(value), [value])
  const inputs = useRef(new Map<string, Editable>())
  const refCache = useRef(new Map<string, (element: Editable | null) => void>())
  const activeRef = useRef<ActiveBlock | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [active, setActive] = useState(0)
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)
  const focusOnce = useRef(false)

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

  const getRef = useCallback((key: string) => {
    let callback = refCache.current.get(key)
    if (!callback) {
      callback = (element: Editable | null) => {
        if (element) inputs.current.set(key, element)
        else inputs.current.delete(key)
      }
      refCache.current.set(key, callback)
    }
    return callback
  }, [])

  const markActive = (line: number, endLine = line) => {
    activeRef.current = { line, endLine }
  }

  useEffect(() => {
    if (!focusTarget) return
    const element = inputs.current.get(focusTarget.key)
    if (!element) {
      setFocusTarget(null)
      return
    }
    element.focus()
    const position =
      focusTarget.caret === 'start'
        ? 0
        : focusTarget.caret === 'end'
          ? element.value.length
          : Math.min(focusTarget.caret, element.value.length)
    element.setSelectionRange(position, position)
    setFocusTarget(null)
  }, [value, focusTarget])

  useEffect(() => {
    if (!autoFocus || focusOnce.current) return
    focusOnce.current = true
    const first = blocks.find(isInlineText)
    if (first) setFocusTarget({ key: `line:${first.line}`, caret: 'end' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, blocks.length])

  const setLine = (block: MdBlock, text: string) => {
    onValueChange(replaceLine(value, block.line, lineForBlock(block, text)))
  }

  const detectSlash = (element: HTMLInputElement, line: number) => {
    if (available.length === 0) {
      setMenu(null)
      return
    }
    const position = element.selectionStart ?? 0
    if (position !== (element.selectionEnd ?? position)) {
      setMenu(null)
      return
    }
    const match = SLASH_LINE.exec(element.value.slice(0, position))
    if (!match) {
      setMenu(null)
      return
    }
    const caret = caretRect(element)
    const box = element.getBoundingClientRect()
    const width = Math.min(MENU_WIDTH, Math.max(180, element.clientWidth))
    let left = box.left + caret.left
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
    let top = box.top + caret.top + caret.height + 2
    if (top + 200 > window.innerHeight) top = Math.max(8, box.top + caret.top - 200)
    setMenu({
      line,
      query: match[2],
      style: { position: 'fixed', left, top, width, zIndex: 90 },
    })
    setActive(0)
  }

  const applyCommand = (command: SlashCommand) => {
    if (!menu) return
    const line = menu.line
    const block = blocks.find((candidate) => candidate.line === line)
    setMenu(null)
    setActive(0)
    if (command.actionId) {
      onCommand?.(command.actionId)
      return
    }
    const insert = typeof command.insert === 'function' ? command.insert() : command.insert
    if (!insert) return
    const source = inputs.current.get(`line:${line}`)
    const caret = source?.selectionStart ?? 0
    const slashStart = Math.max(0, caret - menu.query.length - 1)
    const indent = source ? source.value.slice(0, slashStart) : ''
    const trailing = source ? source.value.slice(caret) : ''
    const count = block?.kind === 'code' ? block.endLine - block.line + 1 : 1
    let replacement: string[]
    if (insert.includes('\n') || insert === '---') {
      // Block commands keep any text that followed the slash on a new line.
      replacement = insert.split('\n')
      if (trailing.trim() !== '') replacement.push(trailing)
    } else {
      // Inline commands keep the rest of the line after the inserted prefix
      // (e.g. /todo in front of "hi" becomes "- [ ] hi").
      const gap = trailing !== '' && !insert.endsWith(' ') ? ' ' : ''
      replacement = [`${indent}${insert}${gap}${trailing}`]
    }
    const next = replaceLines(value, line, count, replacement)
    onValueChange(next.value)
    const first = replacement[0]?.trim() ?? ''
    if (first.startsWith('|')) {
      setFocusTarget({ key: `cell:${line}:-1:0`, caret: 'end' })
    } else if (first.startsWith('```')) {
      setFocusTarget({ key: `code:${line}`, caret: 'start' })
    } else {
      setFocusTarget({ key: `line:${line}`, caret: 'end' })
    }
  }

  const insertAfter = (line: number, text: string, caret: 'start' | 'end' = 'end') => {
    const next = insertLines(value, line + 1, [text])
    onValueChange(next.value)
    setFocusTarget({ key: `line:${next.line}`, caret })
  }

  const handleEnter = (event: ReactKeyboardEvent<HTMLInputElement>, block: MdBlock) => {
    event.preventDefault()
    if (
      block.kind === 'task' ||
      block.kind === 'bullet' ||
      block.kind === 'ordered' ||
      block.kind === 'radio'
    ) {
      if (block.text.trim() === '') {
        onValueChange(replaceLine(value, block.line, ''))
        setFocusTarget({ key: `line:${block.line}`, caret: 'start' })
        return
      }
      if (block.kind === 'task') {
        insertAfter(block.line, taskLine(block.indent, block.marker, false, ''))
      } else if (block.kind === 'bullet') {
        insertAfter(block.line, bulletLine(block.indent, block.marker, ''))
      } else if (block.kind === 'ordered') {
        insertAfter(block.line, orderedLine(block.indent, String(Number(block.number) + 1), ''))
      } else {
        insertAfter(block.line, radioLine(block.indent, block.marker, false, ''))
      }
      return
    }
    if (
      block.kind === 'paragraph' ||
      block.kind === 'spacer' ||
      block.kind === 'heading' ||
      block.kind === 'quote'
    ) {
      insertAfter(block.line, '', 'start')
    }
  }

  const handleBackspace = (event: ReactKeyboardEvent<HTMLInputElement>, block: MdBlock) => {
    const element = event.currentTarget
    const position = element.selectionStart ?? 0
    if (position !== 0 || (element.selectionEnd ?? 0) !== 0) return
    if (block.kind !== 'paragraph' && block.kind !== 'spacer') {
      event.preventDefault()
      const text = block.kind === 'heading' ? block.text : 'text' in block ? block.text : ''
      onValueChange(replaceLine(value, block.line, text))
      setFocusTarget({ key: `line:${block.line}`, caret: 'start' })
      return
    }
    if (block.kind === 'paragraph' && block.text !== '') return
    event.preventDefault()
    const previous = previousEditable(blocks, block.line)
    onValueChange(removeLine(value, block.line))
    if (!previous) return
    if (previous.kind === 'code') setFocusTarget({ key: `code:${previous.line}`, caret: 'end' })
    else if (previous.kind === 'table') setFocusTarget({ key: `cell:${previous.line}:-1:0`, caret: 'end' })
    else setFocusTarget({ key: `line:${previous.line}`, caret: 'end' })
  }

  const handleBlockKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
    block: MdBlock,
  ) => {
    if (menu) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((index) => (items.length === 0 ? 0 : (index + 1) % items.length))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((index) => (items.length === 0 ? 0 : (index - 1 + items.length) % items.length))
        return
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && items.length > 0) {
        event.preventDefault()
        event.stopPropagation()
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
    if (event.key === 'Enter' && !event.shiftKey) {
      handleEnter(event, block)
      return
    }
    if (event.key === 'Backspace') {
      handleBackspace(event, block)
    }
  }

  const renderTextInput = (
    block: MdBlock,
    text: string,
    options: { placeholder?: string; ariaLabel?: string; className?: string } = {},
  ) => {
    const isFirst = block.line === firstEditableLine
    return (
      <div className="rte-input-wrap">
        <input
          ref={getRef(`line:${block.line}`)}
          id={isFirst ? id : undefined}
          className={`rte-input ${options.className ?? ''}`}
          value={text}
          placeholder={options.placeholder}
          aria-label={options.ariaLabel}
          disabled={disabled}
          spellCheck
          onChange={(event) => {
            setLine(block, event.target.value)
            detectSlash(event.currentTarget, block.line)
          }}
          onPaste={(event) => {
            const pastedText = event.clipboardData.getData('text/plain')
            if (!pastedText.includes('\n')) return
            event.preventDefault()
            const element = event.currentTarget
            const start = element.selectionStart ?? 0
            const end = element.selectionEnd ?? start
            const pasted = pastedText.replace(/\r\n/g, '\n').split('\n')
            const merged = [
              element.value.slice(0, start) + pasted[0],
              ...pasted.slice(1, -1),
              pasted[pasted.length - 1] + element.value.slice(end),
            ]
            const lines = merged.map((line, index) => {
              if (block.kind === 'heading') {
                return index === 0 ? headingLine(block.level, line) : line
              }
              if (block.kind === 'ordered') {
                return orderedLine(block.indent, String(Number(block.number) + index), line)
              }
              if (block.kind === 'task') {
                return taskLine(block.indent, block.marker, index === 0 ? block.checked : false, line)
              }
              if (block.kind === 'radio') {
                return radioLine(block.indent, block.marker, index === 0 ? block.checked : false, line)
              }
              return lineForBlock(block, line)
            })
            const next = replaceLines(value, block.line, 1, lines)
            onValueChange(next.value)
            setFocusTarget({ key: `line:${block.line + lines.length - 1}`, caret: 'end' })
          }}
          onSelect={(event) => detectSlash(event.currentTarget, block.line)}
          onKeyDown={(event) => handleBlockKeyDown(event, block)}
          onFocus={() => markActive(block.line)}
          onBlur={() => setMenu(null)}
        />
      </div>
    )
  }

  const renderTable = (block: Extract<MdBlock, { kind: 'table' }>) => {
    const replaceTable = (
      header: string[],
      rows: string[][],
      focus?: { row: number; col: number },
    ) => {
      const next = replaceLines(
        value,
        block.line,
        block.endLine - block.line + 1,
        tableLines(header, rows),
      )
      onValueChange(next.value)
      if (focus) {
        setFocusTarget({
          key: `cell:${block.line}:${focus.row}:${focus.col}`,
          caret: 'end',
        })
      }
    }

    const cellKey = (row: number, col: number) => `cell:${block.line}:${row}:${col}`

    const updateCell = (row: number, col: number, text: string) => {
      const header =
        row === -1 ? block.header.map((cell, index) => (index === col ? text : cell)) : block.header
      const rows =
        row === -1
          ? block.rows
          : block.rows.map((cells, rowIndex) =>
              rowIndex === row ? cells.map((cell, index) => (index === col ? text : cell)) : cells,
            )
      replaceTable(
        header,
        rows.map((cells) => header.map((_, index) => cells[index] ?? '')),
      )
    }

    const moveToNext = (row: number, col: number) => {
      const cells = [
        ...block.header.map((_, index) => ({ row: -1, col: index })),
        ...block.rows.flatMap((cells, rowIndex) =>
          cells.map((_, colIndex) => ({ row: rowIndex, col: colIndex })),
        ),
      ]
      const index = cells.findIndex((cell) => cell.row === row && cell.col === col)
      const next = cells[index + 1]
      if (next) {
        setFocusTarget({ key: cellKey(next.row, next.col), caret: 'end' })
        return
      }
      const rows = [...block.rows, block.header.map(() => '')]
      replaceTable(block.header, rows, { row: rows.length - 1, col: 0 })
    }

    const addRow = () => {
      const rows = [...block.rows, block.header.map(() => '')]
      replaceTable(block.header, rows, { row: rows.length - 1, col: 0 })
    }
    const removeRow = () => {
      if (block.rows.length === 0) return
      const rows = block.rows.slice(0, -1)
      replaceTable(block.header, rows, {
        row: rows.length > 0 ? rows.length - 1 : -1,
        col: 0,
      })
    }
    const addColumn = () => {
      const header = [...block.header, '']
      const rows = block.rows.map((cells) => [...cells, ''])
      replaceTable(header, rows, { row: -1, col: header.length - 1 })
    }
    const removeColumn = () => {
      if (block.header.length <= 1) return
      const header = block.header.slice(0, -1)
      const rows = block.rows.map((cells) => cells.slice(0, -1))
      replaceTable(header, rows, { row: -1, col: 0 })
    }
    const removeTable = () => {
      const next = replaceLines(value, block.line, block.endLine - block.line + 1, [''])
      onValueChange(next.value)
      setFocusTarget({ key: `line:${block.line}`, caret: 'start' })
    }

    return (
      <div className="rte-table-block" key={`table-${block.line}`}>
        <div className="rte-table-actions">
          <button type="button" onClick={addRow} disabled={disabled}>
            + Row
          </button>
          <button type="button" onClick={addColumn} disabled={disabled}>
            + Column
          </button>
          <button type="button" onClick={removeRow} disabled={disabled || block.rows.length === 0}>
            − Row
          </button>
          <button
            type="button"
            onClick={removeColumn}
            disabled={disabled || block.header.length <= 1}
          >
            − Column
          </button>
          <button type="button" onClick={removeTable} disabled={disabled}>
            Delete table
          </button>
        </div>
        <div className="rte-table-wrap">
          <table className="rte-table">
            <thead>
              <tr>
                {block.header.map((cell, col) => (
                  <th key={col}>
                    <input
                      ref={getRef(cellKey(-1, col))}
                      className="rte-cell"
                      value={cell}
                      placeholder={`Column ${col + 1}`}
                      disabled={disabled}
                      onChange={(event) => updateCell(-1, col, event.target.value)}
                      onFocus={() => markActive(block.line, block.endLine)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === 'Tab') {
                          event.preventDefault()
                          event.stopPropagation()
                          moveToNext(-1, col)
                        }
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((cells, row) => (
                <tr key={row}>
                  {cells.map((cell, col) => (
                    <td key={col}>
                      <input
                        ref={getRef(cellKey(row, col))}
                        className="rte-cell"
                        value={cell}
                        disabled={disabled}
                        onChange={(event) => updateCell(row, col, event.target.value)}
                        onFocus={() => markActive(block.line, block.endLine)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === 'Tab') {
                            event.preventDefault()
                            event.stopPropagation()
                            moveToNext(row, col)
                          }
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderBlock = (block: MdBlock) => {
    switch (block.kind) {
      case 'spacer': {
        const paragraph: MdBlock = { kind: 'paragraph', text: '', line: block.line }
        return (
          <div className="rte-block" key={`line-${block.line}`}>
            {renderTextInput(paragraph, '', {
              placeholder: value === '' ? placeholder : undefined,
            })}
          </div>
        )
      }
      case 'hr':
        return (
          <div className="rte-hr-block" key={`hr-${block.line}`}>
            <hr className="md-hr" />
            <button
              type="button"
              className="rte-inline-remove"
              disabled={disabled}
              onClick={() => {
                const next = replaceLines(value, block.line, 1, [''])
                onValueChange(next.value)
                setFocusTarget({ key: `line:${block.line}`, caret: 'start' })
              }}
            >
              Remove
            </button>
          </div>
        )
      case 'image':
        return (
          <div className="rte-image" key={`image-${block.line}`}>
            <NoteImage id={block.id} />
            <button
              type="button"
              className="rte-remove"
              onClick={() => onValueChange(removeLine(value, block.line))}
              disabled={disabled}
            >
              Remove image
            </button>
          </div>
        )
      case 'code':
        return (
          <div className="rte-code-wrap" key={`code-${block.line}`}>
            <div className="rte-table-actions">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = replaceLines(value, block.line, block.endLine - block.line + 1, [
                    '',
                  ])
                  onValueChange(next.value)
                  setFocusTarget({ key: `line:${block.line}`, caret: 'start' })
                }}
              >
                Delete block
              </button>
            </div>
            <textarea
              ref={getRef(`code:${block.line}`)}
              className="rte-code"
              value={block.text}
              disabled={disabled}
              spellCheck={false}
              aria-label="Code block"
              onFocus={() => markActive(block.line, block.endLine)}
              onChange={(event) => {
                const lines = ['```', ...event.target.value.split('\n'), '```']
                const next = replaceLines(
                  value,
                  block.line,
                  block.endLine - block.line + 1,
                  lines,
                )
                onValueChange(next.value)
              }}
            />
          </div>
        )
      case 'table':
        return renderTable(block)
      case 'heading':
        return (
          <div className={`rte-block rte-h${block.level}`} key={`line-${block.line}`}>
            {renderTextInput(block, block.text, { ariaLabel: `Heading ${block.level}` })}
          </div>
        )
      case 'bullet':
        return (
          <div className="rte-block rte-list" key={`line-${block.line}`}>
            <span className="rte-marker" aria-hidden>
              •
            </span>
            {renderTextInput(block, block.text)}
          </div>
        )
      case 'ordered':
        return (
          <div className="rte-block rte-list" key={`line-${block.line}`}>
            <span className="rte-marker" aria-hidden>
              {block.number}.
            </span>
            {renderTextInput(block, block.text)}
          </div>
        )
      case 'task':
        return (
          <div className="rte-block rte-task" key={`line-${block.line}`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={block.checked}
              aria-label={block.text || 'To-do'}
              className={`md-check ${block.checked ? 'checked' : ''}`}
              disabled={disabled}
              onClick={() => onValueChange(toggleTaskLine(value, block.line))}
            >
              {block.checked ? <Check size={12} aria-hidden /> : null}
            </button>
            {renderTextInput(block, block.text, {
              ariaLabel: 'To-do text',
              className: block.checked ? 'rte-done' : '',
            })}
          </div>
        )
      case 'radio':
        return (
          <div className="rte-block rte-task" key={`line-${block.line}`}>
            <button
              type="button"
              role="radio"
              aria-checked={block.checked}
              aria-label={block.text || 'Option'}
              className={`md-radio-dot ${block.checked ? 'checked' : ''}`}
              disabled={disabled}
              onClick={() => onValueChange(selectRadioLine(value, block.line))}
            />
            {renderTextInput(block, block.text, { ariaLabel: 'Option text' })}
          </div>
        )
      case 'quote':
        return (
          <div className="rte-block rte-quote" key={`line-${block.line}`}>
            {renderTextInput(block, block.text)}
          </div>
        )
      default:
        return (
          <div className="rte-block" key={`line-${block.line}`}>
            {renderTextInput(block, block.text, { placeholder })}
          </div>
        )
    }
  }

  const lastBlock = blocks[blocks.length - 1]
  const needsTail =
    value !== '' &&
    lastBlock != null &&
    (lastBlock.kind === 'table' ||
      lastBlock.kind === 'code' ||
      lastBlock.kind === 'image' ||
      lastBlock.kind === 'hr')

  const firstEditableLine = blocks.find(
    (block) => isInlineText(block) || block.kind === 'spacer',
  )?.line

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const activeBlock = activeRef.current
        const line = activeBlock?.line ?? firstEditableLine ?? 0
        setFocusTarget({ key: `line:${line}`, caret: 'end' })
      },
      insertBlock: (text: string) => {
        const activeBlock = activeRef.current
        const block = activeBlock
          ? blocks.find((candidate) => candidate.line === activeBlock.line)
          : undefined
        const at =
          value === ''
            ? 0
            : block
              ? block.kind === 'code' || block.kind === 'table'
                ? block.endLine + 1
                : block.line + 1
              : value.split('\n').length
        const inserted = text.split('\n')
        const next = insertLines(value, at, [...inserted, ''])
        onValueChange(next.value)
        const after = parseMarkdown(next.value).find(
          (candidate) => candidate.line > at + inserted.length - 1 && isInlineText(candidate),
        )
        const targetLine = after?.line ?? next.value.split('\n').length - 1
        setFocusTarget({ key: `line:${targetLine}`, caret: 'end' })
      },
    }),
    [blocks, firstEditableLine, onValueChange, value],
  )

  const handleContainerBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setMenu(null)
    onBlur?.()
  }

  const tailLines = (text: string) => {
    if (text === '') {
      const next = value === '' ? '' : `${value}\n`
      onValueChange(next)
      const line = next === '' ? 0 : next.split('\n').length - 1
      setFocusTarget({ key: `line:${line}`, caret: 'start' })
      return
    }
    const next = value === '' ? text : `${value}\n${text}`
    onValueChange(next)
    setFocusTarget({ key: `line:${next.split('\n').length - 1}`, caret: 'end' })
  }

  return (
    <>
      <div
        className={`rte${className ? ` ${className}` : ''}`}
        style={{ ...style, minHeight: style?.minHeight ?? minHeight ?? SIZE_MIN_HEIGHT[size], maxHeight }}
        role="group"
        aria-label={ariaLabel}
        onBlur={handleContainerBlur}
        data-disabled={disabled ? 'true' : undefined}
      >
      {blocks.map((block) => renderBlock(block))}
      {needsTail && (
        <div className="rte-block" key="tail">
          <div className="rte-input-wrap">
            <input
              className="rte-input"
              value=""
              placeholder={placeholder}
              disabled={disabled}
              onChange={(event) => {
                if (event.target.value !== '') tailLines(event.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  tailLines('')
                }
              }}
            />
          </div>
        </div>
      )}
      </div>
      {menu &&
        createPortal(
          <SlashMenu
            items={items}
            activeIndex={active}
            onPick={applyCommand}
            onHover={setActive}
            style={menu.style}
          />,
          document.body,
        )}
    </>
  )
}
