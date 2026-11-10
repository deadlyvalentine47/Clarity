import { useEffect, useState } from 'react'
import { getNoteImageUrl } from '../db/notes'

export function NoteImage({ id }: { id: string }) {
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
