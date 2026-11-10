import { useMemo, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { NoteImage } from './NoteImage'
import {
  parseMarkdown,
  selectRadioLine,
  toggleTaskLine,
  type MdBlock,
} from '../lib/markdown'

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
const SAFE_LINK_RE = /^https?:\/\//i

function inline(text: string): ReactNode[] {
  return text.split(INLINE_RE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="md-code-inline">
          {part.slice(1, -1)}
        </code>
      )
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (link) {
      if (SAFE_LINK_RE.test(link[2])) {
        return (
          <a key={i} className="md-link" href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        )
      }
      return <span key={i}>{link[1]}</span>
    }
    return <span key={i}>{part}</span>
  })
}

function radioBlock(
  blocks: Extract<MdBlock, { kind: 'radio' }>[],
  content: string,
  onChange?: (next: string) => void,
): ReactNode {
  const interactive = onChange != null
  return (
    <div className="md-radio-group" role="radiogroup" key={`radio-${blocks[0].line}`}>
      {blocks.map((block) => (
        <div className="md-radio" key={`radio-${block.line}`}>
          <button
            type="button"
            role="radio"
            aria-checked={block.checked}
            aria-label={block.text || 'Option'}
            className={`md-radio-dot ${block.checked ? 'checked' : ''}`}
            disabled={!interactive}
            onClick={() => onChange?.(selectRadioLine(content, block.line))}
          />
          <span className="md-task-text">{inline(block.text)}</span>
        </div>
      ))}
    </div>
  )
}

/** Line-based markdown with images and clickable task/radio widgets. */
export default function MarkdownPreview({
  content,
  onChange,
}: {
  content: string
  /** When provided, task and radio widgets rewrite the source text. */
  onChange?: (next: string) => void
}) {
  const blocks = useMemo(() => parseMarkdown(content), [content])

  const render = (block: MdBlock): ReactNode => {
    switch (block.kind) {
      case 'heading': {
        const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4'
        const size = block.level === 1 ? 22 : block.level === 2 ? 18 : 16
        return (
          <Tag key={`b${block.line}`} style={{ fontSize: size, fontWeight: block.level === 1 ? 800 : 700, margin: '4px 0' }}>
            {inline(block.text)}
          </Tag>
        )
      }
      case 'bullet':
        return (
          <div key={`b${block.line}`} style={{ paddingLeft: 12 }}>
            • {inline(block.text)}
          </div>
        )
      case 'ordered':
        return (
          <div key={`b${block.line}`} style={{ paddingLeft: 12 }}>
            {block.number}. {inline(block.text)}
          </div>
        )
      case 'task':
        return (
          <div className="md-task" key={`b${block.line}`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={block.checked}
              aria-label={block.text || 'To-do'}
              className={`md-check ${block.checked ? 'checked' : ''}`}
              disabled={onChange == null}
              onClick={() => onChange?.(toggleTaskLine(content, block.line))}
            >
              {block.checked ? <Check size={12} aria-hidden /> : null}
            </button>
            <span className={block.checked ? 'md-task-text done' : 'md-task-text'}>
              {inline(block.text)}
            </span>
          </div>
        )
      case 'radio':
        // Rendered as a group by the loop below.
        return null
      case 'table':
        return (
          <div className="md-table-wrap" key={`b${block.line}`}>
            <table className="md-table">
              <thead>
                <tr>
                  {block.header.map((cell, index) => (
                    <th key={index}>{inline(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{inline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'quote':
        return (
          <blockquote className="md-quote" key={`b${block.line}`}>
            {inline(block.text)}
          </blockquote>
        )
      case 'code':
        return (
          <pre className="md-code" key={`b${block.line}`}>
            <code>{block.text}</code>
          </pre>
        )
      case 'hr':
        return <hr className="md-hr" key={`b${block.line}`} />
      case 'image':
        return <NoteImage key={`b${block.line}`} id={block.id} />
      case 'spacer':
        return <div key={`b${block.line}`} style={{ height: 6 }} />
      default:
        return <div key={`b${block.line}`}>{inline(block.text)}</div>
    }
  }

  const nodes: ReactNode[] = []
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block.kind !== 'radio') {
      nodes.push(render(block))
      continue
    }
    const group = [block]
    let next = i + 1
    while (next < blocks.length) {
      const candidate = blocks[next]
      if (candidate.kind !== 'radio' || candidate.group !== block.group) break
      group.push(candidate)
      next += 1
    }
    nodes.push(radioBlock(group, content, onChange))
    i = next - 1
  }

  return (
    <div
      className="markdown-body"
      style={{ display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.6 }}
    >
      {nodes}
    </div>
  )
}
