import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronRight,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { db } from '../db/db'
import type { Note } from '../db/types'
import {
  addChildNote,
  deleteNoteWithDescendants,
  insertImageMarker,
  notePath,
  noteSnippet,
  noteTags,
  saveNoteImage,
  sortNotes,
} from '../db/notes'
import { formatDateTime } from '../lib/dates'
import MarkdownPreview from '../components/MarkdownPreview'
import {
  ConfirmDialog,
  Dialog,
  IconButton,
  TextInput,
} from '../components/ui'

export default function NoteDetailScreen() {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const id = Number(noteId)
  const fileRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  const note = useLiveQuery(async () => (id ? ((await db.notes.get(id)) ?? null) : null), [id])
  const allNotes = useLiveQuery(async () => db.notes.toArray(), [], [])
  const categories = useLiveQuery(async () => db.noteCategories.toArray().then((c) => c.sort((a, b) => a.name.localeCompare(b.name))), [], [])

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [showAddTag, setShowAddTag] = useState(false)
  const [showAddPage, setShowAddPage] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteChild, setDeleteChild] = useState<Note | null>(null)
  const [uploading, setUploading] = useState(false)

  const children = useMemo(
    () => sortNotes((allNotes ?? []).filter((n) => n.parentNoteId === id)),
    [allNotes, id],
  )
  const path = useMemo(() => (note ? notePath(allNotes ?? [], note.id!) : []), [allNotes, note])

  if (note === undefined) return <div className="empty">Loading…</div>

  if (note === null) {
    return (
      <div className="empty">
        <div className="bold" style={{ color: 'var(--text)', fontSize: 20 }}>Note not found</div>
        <button className="btn btn-primary" onClick={() => navigate('/notes')}>Back to notes</button>
      </div>
    )
  }

  const startEditing = () => {
    setEditTitle(note.title)
    setEditContent(note.content)
    setTags(noteTags(note))
    setEditing(true)
  }

  const save = async () => {
    await db.notes.update(note.id!, {
      title: editTitle.trim() || 'Untitled',
      content: editContent,
      category: tags.join(', '),
      updatedAt: Date.now(),
    })
    setEditing(false)
  }

  const availableTags = (categories ?? []).map((c) => c.name).filter((c) => !tags.some((t) => t.toLowerCase() === c.toLowerCase()))

  const onPickImage = async (file: File) => {
    setUploading(true)
    try {
      const imageId = await saveNoteImage(file)
      const cursor = areaRef.current?.selectionStart ?? editContent.length
      const next = insertImageMarker(editContent, cursor, imageId)
      setEditContent(next.content)
      requestAnimationFrame(() => {
        areaRef.current?.focus()
        areaRef.current?.setSelectionRange(next.cursor, next.cursor)
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
        <div className="row grow" style={{ minWidth: 0 }}>
          <IconButton label="Back" onClick={() => (note.parentNoteId != null ? navigate(`/notes/${note.parentNoteId}`) : navigate('/notes'))}>
            <ArrowLeft size={22} />
          </IconButton>
          <div className="grow" style={{ minWidth: 0 }}>
            <h1 className="page-title truncate" style={{ fontSize: 20 }}>{note.title}</h1>
            <p className="tiny muted">{formatDateTime(note.updatedAt)}</p>
          </div>
        </div>

        <div className="row" style={{ gap: 0 }}>
          <IconButton label={note.isPinned ? 'Unpin' : 'Pin'} onClick={() => void db.notes.update(note.id!, { isPinned: !note.isPinned })}>
            {note.isPinned ? <BookmarkCheck size={20} color="var(--primary)" /> : <Bookmark size={20} />}
          </IconButton>
          <IconButton label={editing ? 'Save' : 'Edit'} onClick={() => (editing ? void save() : startEditing())}>
            {editing ? <Check size={20} /> : <Pencil size={20} />}
          </IconButton>
          <IconButton label="Delete" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={20} color="var(--error)" />
          </IconButton>
        </div>
      </div>

      {path.length > 1 && (
        <div className="row wrap tiny muted" style={{ marginBottom: 12, gap: 2 }}>
          {path.slice(0, -1).map((p) => (
            <span key={p.id} className="row" style={{ gap: 2 }}>
              <button
                className="chip soft"
                style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => navigate(`/notes/${p.id}`)}
              >
                {p.title}
              </button>
              <ChevronRight size={12} />
            </span>
          ))}
        </div>
      )}

      {editing ? (
        <div className="stack">
          <TextInput value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" aria-label="Title" />

          <div>
            <div className="label" style={{ marginBottom: 6 }}>Tags</div>
            <div className="row wrap">
              {tags.map((tag) => (
                <button key={tag} className="chip active" onClick={() => setTags(tags.filter((t) => t !== tag))}>
                  {tag} <X size={13} />
                </button>
              ))}
              <button className="chip" onClick={() => setShowAddTag(true)} type="button">
                <Plus size={14} /> Tag
              </button>
            </div>
          </div>

          <div className="row-between">
            <span className="label">Content (Markdown supported)</span>
            <button className="btn btn-sm btn-outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <ImagePlus size={15} /> {uploading ? 'Adding…' : 'Add image'}
            </button>
          </div>
          <textarea
            ref={areaRef}
            className="textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Write in markdown..."
            style={{ minHeight: '38vh' }}
          />
          {editContent.trim() && (
            <div className="card" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Preview</div>
              <MarkdownPreview content={editContent} />
            </div>
          )}
        </div>
      ) : (
        <>
          {noteTags(note).length > 0 && (
            <div className="row wrap" style={{ marginBottom: 14 }}>
              {noteTags(note).map((tag) => (
                <span key={tag} className="chip soft">{tag}</span>
              ))}
            </div>
          )}

          <div className="card" style={{ marginBottom: 16 }}>
            {note.content.trim() ? (
              <MarkdownPreview content={note.content} />
            ) : (
              <p className="small muted">This note is empty. Tap the pencil to write something.</p>
            )}
          </div>

          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="section-label">Pages inside ({children.length})</span>
            <button className="btn btn-sm btn-outline" onClick={() => setShowAddPage(true)}>
              <Plus size={15} /> Add page
            </button>
          </div>

          {children.length === 0 ? (
            <div className="card">
              <p className="small muted">No pages yet. Add a page to organise nested content.</p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {children.map((child) => (
                <div key={child.id} className="card clickable" style={{ padding: 14 }} onClick={() => navigate(`/notes/${child.id}`)}>
                  <div className="row-between">
                    <div style={{ minWidth: 0 }}>
                      <div className="bold truncate">{child.title}</div>
                      {child.content && <div className="small muted truncate">{noteSnippet(child.content)}</div>}
                      <div className="tiny muted">{formatDateTime(child.updatedAt)}</div>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label={`Delete ${child.title}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteChild(child)
                      }}
                    >
                      <Trash2 size={16} color="var(--error)" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onPickImage(file)
          e.target.value = ''
        }}
      />

      <Dialog
        open={showAddTag}
        onClose={() => setShowAddTag(false)}
        title="Add Tag"
      >
        {availableTags.length === 0 ? (
          <p className="small muted">No more tags. Create tags from the Notes screen.</p>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {availableTags.map((tag) => (
              <button
                key={tag}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => {
                  setTags((t) => [...t, tag])
                  setShowAddTag(false)
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </Dialog>

      <Dialog
        open={showAddPage}
        onClose={() => setShowAddPage(false)}
        title="Add Page"
      >
        <AddPageDialog
          onAdd={async (title) => {
            await addChildNote(note.id!, title)
            setShowAddPage(false)
          }}
          onCancel={() => setShowAddPage(false)}
        />
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Note"
        message={
          children.length > 0
            ? `Delete "${note.title}" and all its nested pages? This also removes attached images.`
            : `Delete "${note.title}"? This also removes attached images.`
        }
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteNoteWithDescendants(note.id!)
          const parent = note.parentNoteId
          navigate(parent != null ? `/notes/${parent}` : '/notes')
        }}
      />

      <ConfirmDialog
        open={deleteChild != null}
        title="Delete Page"
        message={`Delete "${deleteChild?.title}" and all its nested pages?`}
        onCancel={() => setDeleteChild(null)}
        onConfirm={async () => {
          if (deleteChild?.id != null) {
            await deleteNoteWithDescendants(deleteChild.id)
          }
          setDeleteChild(null)
        }}
      />
    </>
  )
}

function AddPageDialog({ onAdd, onCancel }: { onAdd: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  return (
    <div className="stack">
      <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" aria-label="Page title" />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => title.trim() && onAdd(title.trim())} disabled={!title.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}
