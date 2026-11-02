import { useEffect, useState, type ReactNode } from 'react'
import { getNoteImageUrl } from '../db/notes'

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <span key={i}>{part}</span>
  })
}

function NoteImage({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    void getNoteImageUrl(id).then((next) => {
      if (alive) setUrl(next)
    })
    return () => {
      alive = false
    }
  }, [id])

  if (!url) return <span className="tiny muted">[missing image]</span>
  // The bytes are there but the WebView cannot decode them (e.g. HEIC on an
  // older Android); say so instead of showing a broken image.
  if (failed) return <span className="tiny muted">[image format not supported]</span>
  return (
    <img
      src={url}
      alt="Note attachment"
      onError={() => setFailed(true)}
      style={{ maxWidth: '100%', borderRadius: 10, margin: '6px 0' }}
    />
  )
}

/** Port of MarkdownPreview in NotesScreen.kt (line-based markdown) + image markers. */
export default function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n')

  return (
    <div className="markdown-body" style={{ display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.6 }}>
      {lines.map((line, i) => {
        const image = line.trim().match(/^!\[img:([a-fA-F0-9-]+)\]$/)
        if (image) return <NoteImage key={i} id={image[1]} />
        if (line.startsWith('### ')) {
          return (
            <h4 key={i} style={{ fontSize: 16, fontWeight: 700, margin: '4px 0' }}>
              {inline(line.slice(4))}
            </h4>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={i} style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>
              {inline(line.slice(3))}
            </h3>
          )
        }
        if (line.startsWith('# ')) {
          return (
            <h2 key={i} style={{ fontSize: 22, fontWeight: 800, margin: '4px 0' }}>
              {inline(line.slice(2))}
            </h2>
          )
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} style={{ paddingLeft: 12 }}>
              • {inline(line.slice(2))}
            </div>
          )
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <div key={i} style={{ paddingLeft: 12 }}>
              {inline(line)}
            </div>
          )
        }
        if (line.trim() === '') {
          return <div key={i} style={{ height: 6 }} />
        }
        return <div key={i}>{inline(line)}</div>
      })}
    </div>
  )
}
