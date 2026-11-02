import { db } from './db'
import type { Note } from './types'

export const NOTE_IMAGE_REGEX = /!\[img:([a-fA-F0-9-]+)\]/g

export function noteTags(note: Note): string[] {
  return note.category
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt
    return (a.id ?? 0) - (b.id ?? 0)
  })
}

export function childrenByParent(notes: Note[]): Map<number | null, Note[]> {
  const map = new Map<number | null, Note[]>()
  for (const note of notes) {
    const parent = note.parentNoteId ?? null
    const list = map.get(parent) ?? []
    list.push(note)
    map.set(parent, list)
  }
  for (const [key, list] of map) map.set(key, sortNotes(list))
  return map
}

export interface FlatNote {
  note: Note
  depth: number
}

/** DFS tree; children are only emitted when their parent is expanded. */
export function flattenTree(notes: Note[], expanded: Set<number>): FlatNote[] {
  const map = childrenByParent(notes)
  const seen = new Set<number>()
  const out: FlatNote[] = []
  const walk = (parent: number | null, depth: number) => {
    for (const note of map.get(parent) ?? []) {
      if (note.id == null || seen.has(note.id)) continue
      seen.add(note.id)
      out.push({ note, depth })
      if (expanded.has(note.id)) walk(note.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export function descendantIds(notes: Note[], rootId: number): number[] {
  const map = childrenByParent(notes)
  const out: number[] = []
  const stack = [rootId]
  const seen = new Set<number>()
  while (stack.length) {
    const id = stack.pop()!
    for (const child of map.get(id) ?? []) {
      if (child.id == null || seen.has(child.id)) continue
      seen.add(child.id)
      out.push(child.id)
      stack.push(child.id)
    }
  }
  return out
}

export function isDescendant(notes: Note[], candidateId: number, ancestorId: number): boolean {
  return descendantIds(notes, ancestorId).includes(candidateId)
}

export function notePath(notes: Note[], noteId: number): Note[] {
  const byId = new Map(notes.map((n) => [n.id!, n]))
  const path: Note[] = []
  let current = byId.get(noteId)
  const seen = new Set<number>()
  while (current && current.id != null && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current)
    current = current.parentNoteId != null ? byId.get(current.parentNoteId) : undefined
  }
  return path
}

/** Move a note relative to a target, renumbering siblings atomically. */
export async function moveNote(
  draggedId: number,
  targetId: number,
  zone: 'above' | 'below' | 'inside',
): Promise<void> {
  const notes = await db.notes.toArray()
  const dragged = notes.find((n) => n.id === draggedId)
  const target = notes.find((n) => n.id === targetId)
  if (!dragged || !target || draggedId === targetId) return

  const newParentId = zone === 'inside' ? targetId : target.parentNoteId ?? null
  if (newParentId === draggedId || (newParentId != null && isDescendant(notes, newParentId, draggedId))) {
    throw new Error('A note cannot be moved inside its own sub-page')
  }

  const siblings = sortNotes(
    notes.filter((n) => n.id !== draggedId && (n.parentNoteId ?? null) === newParentId),
  )
  let index = siblings.length
  if (zone !== 'inside') {
    const targetIndex = siblings.findIndex((n) => n.id === targetId)
    index = zone === 'above' ? targetIndex : targetIndex + 1
  }

  const ordered = [...siblings.slice(0, index), dragged, ...siblings.slice(index)]

  await db.transaction('rw', db.notes, async () => {
    for (let i = 0; i < ordered.length; i++) {
      const note = ordered[i]
      if (note.id == null) continue
      const sortOrder = (i + 1) * 10
      const patch: Partial<Note> = {}
      if (note.id === draggedId) patch.parentNoteId = newParentId
      if (note.sortOrder !== sortOrder) patch.sortOrder = sortOrder
      if (Object.keys(patch).length) await db.notes.update(note.id, patch)
    }
    // Bump updatedAt so the moved note is clearly the most recent edit.
    await db.notes.update(draggedId, { updatedAt: Date.now() })
  })
}

export async function deleteNoteWithDescendants(noteId: number): Promise<void> {
  const notes = await db.notes.toArray()
  const ids = [noteId, ...descendantIds(notes, noteId)]

  await db.transaction('rw', db.notes, db.noteImages, async () => {
    for (const note of notes.filter((n) => n.id != null && ids.includes(n.id))) {
      await deleteImagesInContent(note.content)
    }
    await db.notes.bulkDelete(ids)
  })
}

/** Create a child page under a note, appended to the end of the sibling list. */
export async function addChildNote(
  parentId: number,
  title: string,
  content = '',
): Promise<number> {
  const siblings = await db.notes.where('parentNoteId').equals(parentId).toArray()
  const maxOrder = siblings.reduce((max, n) => Math.max(max, n.sortOrder), 0)
  const now = Date.now()
  return db.notes.add({
    title: title.trim() || 'Untitled',
    content,
    isPinned: false,
    category: '',
    parentNoteId: parentId,
    sortOrder: maxOrder + 10,
    createdAt: now,
    updatedAt: now,
  }) as Promise<number>
}

// ------------------------------------------------------------------ images

const urlCache = new Map<string, string>()

export function extractImageIds(content: string): string[] {
  const ids: string[] = []
  for (const match of content.matchAll(NOTE_IMAGE_REGEX)) ids.push(match[1])
  return [...new Set(ids)]
}

export async function saveNoteImage(file: File): Promise<string> {
  const id = crypto.randomUUID()
  const blob = await downscaleImage(file)
  await db.noteImages.add({ id, blob, createdAt: Date.now() })
  return id
}

export async function getNoteImageUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id)
  if (cached) return cached
  const image = await db.noteImages.get(id)
  if (!image) return null
  const url = URL.createObjectURL(image.blob)
  urlCache.set(id, url)
  return url
}

export async function deleteImagesInContent(content: string): Promise<void> {
  const ids = extractImageIds(content)
  for (const id of ids) {
    const url = urlCache.get(id)
    if (url) {
      URL.revokeObjectURL(url)
      urlCache.delete(id)
    }
    await db.noteImages.delete(id)
  }
}

/** Insert an image marker at the cursor, adding line breaks if needed. */
export function insertImageMarker(
  content: string,
  selectionStart: number,
  imageId: string,
): { content: string; cursor: number } {
  const marker = `![img:${imageId}]`
  let pos = Math.max(0, Math.min(selectionStart, content.length))
  let prefix = ''
  let suffix = ''
  if (pos > 0 && content[pos - 1] !== '\n') prefix = '\n'
  if (pos < content.length && content[pos] !== '\n') suffix = '\n'
  const next = content.slice(0, pos) + prefix + marker + suffix + content.slice(pos)
  return { content: next, cursor: pos + prefix.length + marker.length }
}

async function downscaleImage(file: Blob, maxSide = 1280, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob ?? file
  } catch {
    return file
  }
}

/** Markdown/image markers stripped for compact list previews. */
export function noteSnippet(content: string, max = 140): string {
  const text = content
    .replace(/!\[img:[a-fA-F0-9-]+\]/g, '[image]')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
