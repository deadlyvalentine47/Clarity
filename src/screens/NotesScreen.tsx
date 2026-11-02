import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronRight,
  Filter,
  GripVertical,
  Plus,
  Search,
  StickyNote,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { db } from '../db/db'
import type { Note, NoteCategory } from '../db/types'
import {
  addChildNote,
  deleteNoteWithDescendants,
  flattenTree,
  moveNote,
  noteSnippet,
  noteTags,
  sortNotes,
} from '../db/notes'
import { formatDate } from '../lib/dates'
import { useDragAutoScroll } from '../lib/dragAutoScroll'
import MarkdownPreview from '../components/MarkdownPreview'
import {
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from '../components/ui'

type DropZone = 'above' | 'below' | 'inside'

export default function NotesScreen() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [showFilter, setShowFilter] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [dragged, setDragged] = useState<number | null>(null)
  const [hover, setHover] = useState<{ id: number; zone: DropZone } | null>(null)
  const [error, setError] = useState('')

  useDragAutoScroll(dragged != null)

  const notes = useLiveQuery(async () => db.notes.toArray(), [], [])
  const categories = useLiveQuery(async () => db.noteCategories.toArray().then((c) => c.sort((a, b) => a.name.localeCompare(b.name))), [], [])

  const treeMode = query.trim() === '' && selectedCategories.size === 0
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (notes ?? [])
      .filter((note) => {
        if (q && !note.title.toLowerCase().includes(q) && !note.content.toLowerCase().includes(q)) return false
        if (selectedCategories.size === 0) return true
        const pinned = selectedCategories.has('Pinned')
        const tags = noteTags(note).map((t) => t.toLowerCase())
        const tagMatch = [...selectedCategories]
          .filter((c) => c !== 'Pinned')
          .some((c) => tags.includes(c.toLowerCase()))
        return (pinned && note.isPinned) || tagMatch
      })
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt)
  }, [notes, query, selectedCategories])

  const tree = useMemo(() => flattenTree(notes ?? [], expanded), [notes, expanded])
  const childCount = useMemo(() => {
    const map = new Map<number, number>()
    for (const note of notes ?? []) {
      if (note.parentNoteId != null) map.set(note.parentNoteId, (map.get(note.parentNoteId) ?? 0) + 1)
    }
    return map
  }, [notes])

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const drop = async (targetId: number, zone: DropZone) => {
    if (dragged == null) return
    const id = dragged
    setHover(null)
    setDragged(null)
    try {
      await moveNote(id, targetId, zone)
      setExpanded((prev) => new Set(prev).add(targetId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move note')
    }
  }

  /** Append the dragged note to the end of the top-level list. */
  const dropToEnd = () => {
    if (dragged == null) return
    const id = dragged
    const roots = sortNotes((notes ?? []).filter((n) => (n.parentNoteId ?? null) === null))
    const last = roots[roots.length - 1]
    setHover(null)
    setDragged(null)
    if (!last?.id || last.id === id) return
    void moveNote(id, last.id, 'below').catch((e) => {
      setError(e instanceof Error ? e.message : 'Could not move note')
    })
  }

  return (
    <>
      <PageHeader
        title="Notes"
        subtitle={treeMode ? `${(notes ?? []).length} notes in ${(notes ?? []).filter((n) => n.parentNoteId == null).length} top-level pages` : `${filtered.length} matching notes`}
        actions={
          <>
            <div style={{ position: 'relative' }}>
              <IconButton label="Filter notes" onClick={() => setShowFilter(true)}>
                <Filter size={20} />
              </IconButton>
              {selectedCategories.size > 0 && (
                <span className="badge primary" style={{ position: 'absolute', top: 0, right: 0, padding: '0 5px', minWidth: 16, justifyContent: 'center' }}>
                  {selectedCategories.size}
                </span>
              )}
            </div>
            <IconButton label="Manage categories" onClick={() => setShowManage(true)}>
              <Tag size={20} />
            </IconButton>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Note
            </button>
          </>
        }
      />

      <div className="search" style={{ marginBottom: 12 }}>
        <Search size={18} />
        <input className="input" placeholder="Search notes..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {selectedCategories.size > 0 && (
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {[...selectedCategories].map((cat) => (
            <button
              key={cat}
              className="chip active"
              onClick={() => setSelectedCategories((prev) => {
                const next = new Set(prev)
                next.delete(cat)
                return next
              })}
            >
              {cat} <X size={13} />
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="card" style={{ marginBottom: 12, background: 'var(--error-container)', color: 'var(--error)', boxShadow: 'none' }}>
          <div className="row-between">
            <span className="small">{error}</span>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => setError('')}><X size={16} /></button>
          </div>
        </div>
      )}

      {treeMode ? (
        tree.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<StickyNote size={40} />}
              title="No notes yet"
              subtitle="Create a note, then drag notes onto each other to build nested pages."
              action={<button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> New note</button>}
            />
          </div>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {tree.map(({ note, depth }) => (
              <NoteCard
                key={note.id}
                note={note}
                depth={depth}
                childCount={childCount.get(note.id!) ?? 0}
                expanded={expanded.has(note.id!)}
                onToggle={() => toggleExpanded(note.id!)}
                onOpen={() => navigate(`/notes/${note.id}`)}
                dragging={dragged === note.id}
                dropZone={hover && hover.id === note.id ? hover.zone : null}
                onDragStart={() => {
                  setDragged(note.id!)
                  setHover(null)
                }}
                onDragEnd={() => {
                  setDragged(null)
                  setHover(null)
                }}
                onDragOver={(zone) => setHover({ id: note.id!, zone })}
                onDrop={(zone) => void drop(note.id!, zone)}
              />
            ))}
            {dragged != null && (
              <div
                className="drop-end"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  dropToEnd()
                }}
              >
                Move to the end
              </div>
            )}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<StickyNote size={40} />} title="No notes found" subtitle="No notes match your search or filters." />
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              depth={0}
              childCount={childCount.get(note.id!) ?? 0}
              expanded={false}
              onToggle={() => {}}
              onOpen={() => navigate(`/notes/${note.id}`)}
              dragging={false}
              dropZone={null}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              onDragOver={() => {}}
              onDrop={() => {}}
            />
          ))}
        </div>
      )}

      <button className="fab" aria-label="Add note" onClick={() => setShowAdd(true)}>
        <Plus size={26} />
      </button>

      {showAdd && <NoteDialog categories={(categories ?? []).map((c) => c.name)} notes={notes ?? []} onClose={() => setShowAdd(false)} />}
      {showFilter && (
        <FilterDialog
          categories={(categories ?? []).map((c) => c.name)}
          selected={selectedCategories}
          onApply={(next) => {
            setSelectedCategories(next)
            setShowFilter(false)
          }}
          onClose={() => setShowFilter(false)}
        />
      )}
      {showManage && <ManageCategoriesDialog categories={categories ?? []} onClose={() => setShowManage(false)} />}
    </>
  )
}

function NoteCard({
  note,
  depth,
  childCount,
  expanded,
  onToggle,
  onOpen,
  dragging,
  dropZone,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  note: Note
  depth: number
  childCount: number
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
  dragging: boolean
  dropZone: DropZone | null
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (zone: DropZone) => void
  onDrop: (zone: DropZone) => void
}) {
  const [confirm, setConfirm] = useState(false)
  const tags = noteTags(note)

  return (
    <div
      className={`card note-card clickable ${dragging ? 'dragging' : ''} ${dropZone ? `drop-${dropZone}` : ''}`}
      style={{ marginLeft: depth * 20, padding: 14 }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(note.id))
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        const rect = e.currentTarget.getBoundingClientRect()
        const y = e.clientY - rect.top
        const zone: DropZone = y < rect.height * 0.3 ? 'above' : y > rect.height * 0.65 ? 'below' : 'inside'
        onDragOver(zone)
      }}
      onDrop={(e) => {
        e.preventDefault()
        // Recompute from the drop event so a quick release can't use a stale
        // hover zone (which made "drop after the last note" silently fail).
        const rect = e.currentTarget.getBoundingClientRect()
        const y = e.clientY - rect.top
        const zone: DropZone = y < rect.height * 0.3 ? 'above' : y > rect.height * 0.65 ? 'below' : 'inside'
        onDrop(zone)
      }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`Open note ${note.title}`}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="drag-handle" title="Drag to reorder or nest" aria-hidden>
          <GripVertical size={16} />
        </span>
        {childCount > 0 ? (
          <button
            className="tree-toggle"
            aria-label={expanded ? 'Collapse sub-pages' : 'Expand sub-pages'}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="tree-spacer" />
        )}

        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row-between">
            <div className="bold truncate">{note.title}</div>
            <div className="icon-actions">
              <button
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                aria-label={note.isPinned ? 'Unpin' : 'Pin'}
                onClick={(e) => {
                  e.stopPropagation()
                  if (note.id != null) void db.notes.update(note.id, { isPinned: !note.isPinned })
                }}
              >
                {note.isPinned ? <BookmarkCheck size={16} color="var(--primary)" /> : <Bookmark size={16} />}
              </button>
              <button
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                aria-label="Delete note"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirm(true)
                }}
              >
                <Trash2 size={15} color="var(--error)" />
              </button>
            </div>
          </div>

          {note.content && (
            <p
              className="small muted"
              style={{ marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {noteSnippet(note.content)}
            </p>
          )}

          <div className="row-between" style={{ marginTop: 6, gap: 8 }}>
            <span className="tiny muted">
              {formatDate(note.createdAt)}
              {childCount > 0 ? ` · ${childCount} sub-page${childCount === 1 ? '' : 's'}` : ''}
            </span>
            {tags.length > 0 && (
              <span className="pill-list">
                {tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="chip soft" style={{ padding: '2px 8px', fontSize: 11 }}>{tag}</span>
                ))}
              </span>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Delete Note"
        message={
          childCount > 0
            ? `Delete "${note.title}" and all ${childCount} nested page(s)?`
            : `Delete "${note.title}"?`
        }
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          if (note.id != null) await deleteNoteWithDescendants(note.id)
          setConfirm(false)
        }}
      />
    </div>
  )
}

function FilterDialog({
  categories,
  selected,
  onApply,
  onClose,
}: {
  categories: string[]
  selected: Set<string>
  onApply: (next: Set<string>) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState(new Set(selected))
  const toggle = (key: string) =>
    setLocal((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <Dialog
      open
      onClose={onClose}
      title="Filter Notes"
      footer={
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-outline" onClick={() => setLocal(new Set())}>Clear all</button>
          <div className="row">
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={() => onApply(local)}>Apply</button>
          </div>
        </div>
      }
    >
      <div className="row" style={{ padding: '6px 0' }}>
        <Checkbox checked={local.has('Pinned')} onChange={() => toggle('Pinned')} label="Pinned" />
        <span>Pinned</span>
      </div>
      {categories.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 12, marginBottom: 4 }}>Tags</div>
          {categories.map((cat) => (
            <div key={cat} className="row" style={{ padding: '6px 0' }}>
              <Checkbox checked={local.has(cat)} onChange={() => toggle(cat)} label={cat} />
              <span>{cat}</span>
            </div>
          ))}
        </>
      )}
    </Dialog>
  )
}

function ManageCategoriesDialog({ categories, onClose }: { categories: NoteCategory[]; onClose: () => void }) {
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<NoteCategory | null>(null)
  const [error, setError] = useState('')

  const add = async () => {
    const value = name.trim()
    if (!value) return
    if (categories.some((c) => c.name.toLowerCase() === value.toLowerCase())) {
      setError('That tag already exists')
      return
    }
    await db.noteCategories.add({ name: value, createdAt: Date.now() })
    setName('')
    setError('')
  }

  return (
    <>
      <Dialog open onClose={onClose} title="Manage Tags" footer={<button className="btn btn-primary btn-block" onClick={onClose}>Done</button>}>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void add() }}>
          <TextInput placeholder="New tag" value={name} onChange={(e) => { setName(e.target.value); setError('') }} />
          <button className="btn btn-primary btn-sm" type="submit" disabled={!name.trim()}>Add</button>
        </form>
        {error && <p className="tiny" style={{ color: 'var(--error)', marginTop: 6 }}>{error}</p>}

        <div style={{ marginTop: 12 }}>
          {categories.length === 0 ? (
            <p className="small muted">No tags yet. Tags are optional labels for notes.</p>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--outline)' }}>
                <span>{cat.name}</span>
                <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label={`Delete ${cat.name}`} onClick={() => setDeleting(cat)}>
                  <Trash2 size={16} color="var(--error)" />
                </button>
              </div>
            ))
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting != null}
        title="Delete Tag"
        message={`Delete "${deleting?.name}"? Notes keep the tag text but it is no longer suggested.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting?.id != null) await db.noteCategories.delete(deleting.id)
          setDeleting(null)
        }}
      />
    </>
  )
}

function NoteDialog({ categories, notes, onClose }: { categories: string[]; notes: Note[]; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [parentId, setParentId] = useState('')
  const [tab, setTab] = useState<'Edit' | 'Preview'>('Edit')

  const save = async () => {
    if (!title.trim()) return
    const now = Date.now()
    if (parentId) {
      const id = await addChildNote(Number(parentId), title.trim(), content.trim())
      if (tags.length > 0) await db.notes.update(id, { category: tags.join(', ') })
    } else {
      await db.notes.add({
        title: title.trim(),
        content: content.trim(),
        category: tags.join(', '),
        isPinned: false,
        parentNoteId: null,
        sortOrder: now,
        createdAt: now,
        updatedAt: now,
      })
    }
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Note"
      footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!title.trim()}>Create</button>
        </div>
      }
    >
      <div className="stack">
        <Field label="Title *">
          <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
        </Field>

        <Field label="Parent page" hint="Optional — makes this note a sub-page.">
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Top level</option>
            {sortNotes(notes).map((n) => (
              <option key={n.id} value={n.id}>{n.title}</option>
            ))}
          </Select>
        </Field>

        <div className="segmented" style={{ alignSelf: 'flex-start' }}>
          <button className={tab === 'Edit' ? 'active' : ''} onClick={() => setTab('Edit')} type="button">Edit</button>
          <button className={tab === 'Preview' ? 'active' : ''} onClick={() => setTab('Preview')} type="button">Preview</button>
        </div>

        {tab === 'Edit' ? (
          <TextArea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write in markdown..." style={{ minHeight: 170 }} />
        ) : content.trim() ? (
          <div className="card" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
            <MarkdownPreview content={content} />
          </div>
        ) : (
          <p className="small muted">Nothing to preview</p>
        )}

        <Field label="Tags">
          <div className="chip-row">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`chip ${tags.includes(cat) ? 'active' : ''}`}
                onClick={() => setTags((prev) => prev.includes(cat) ? prev.filter((t) => t !== cat) : [...prev, cat])}
              >
                {cat}
              </button>
            ))}
          </div>
          {categories.length === 0 && <span className="tiny muted">Create tags from the Notes screen.</span>}
        </Field>
      </div>
    </Dialog>
  )
}
