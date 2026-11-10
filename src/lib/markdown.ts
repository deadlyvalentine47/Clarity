// Line-based markdown used by MarkdownPreview and the note editors.
// Blocks keep their source line index so widgets can rewrite the text in place.

export type MdBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string; line: number }
  | { kind: 'bullet'; text: string; line: number }
  | { kind: 'ordered'; text: string; line: number }
  | { kind: 'task'; checked: boolean; text: string; line: number }
  | { kind: 'radio'; checked: boolean; text: string; line: number; group: number }
  | { kind: 'table'; header: string[]; rows: string[][]; line: number; endLine: number }
  | { kind: 'quote'; text: string; line: number }
  | { kind: 'code'; text: string; line: number; endLine: number }
  | { kind: 'hr'; line: number }
  | { kind: 'image'; id: string; line: number }
  | { kind: 'spacer'; line: number }
  | { kind: 'paragraph'; text: string; line: number }

const IMAGE_RE = /^!\[img:([a-fA-F0-9-]+)\]$/
const HEADING_RE = /^(#{1,3})\s+(.*)$/
const TASK_RE = /^([ \t]*)[-*+]\s+\[([ xX])\]\s?(.*)$/
const RADIO_RE = /^([ \t]*)[-*+]\s+\(([ xX])\)\s?(.*)$/
const BULLET_RE = /^([ \t]*)[-*+]\s+(.*)$/
const ORDERED_RE = /^([ \t]*)\d+[.)]\s+.*$/
const QUOTE_RE = /^\s*>\s?(.*)$/
const HR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

function splitRow(line: string): string[] {
  let value = line.trim()
  if (value.startsWith('|')) value = value.slice(1)
  if (value.endsWith('|')) value = value.slice(0, -1)
  return value.split('|').map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  if (!line.includes('|')) return false
  const cells = splitRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell))
}

export function parseMarkdown(content: string): MdBlock[] {
  const lines = content.split('\n')
  const blocks: MdBlock[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') {
      blocks.push({ kind: 'spacer', line: i })
      continue
    }

    const image = IMAGE_RE.exec(trimmed)
    if (image) {
      blocks.push({ kind: 'image', id: image[1], line: i })
      continue
    }

    if (trimmed.startsWith('```')) {
      let end = i + 1
      while (end < lines.length && !lines[end].trim().startsWith('```')) end += 1
      blocks.push({
        kind: 'code',
        text: lines.slice(i + 1, end).join('\n'),
        line: i,
        endLine: Math.min(end, lines.length - 1),
      })
      i = end
      continue
    }

    if (HR_RE.test(line)) {
      blocks.push({ kind: 'hr', line: i })
      continue
    }

    const heading = HEADING_RE.exec(trimmed)
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: Math.min(heading[1].length, 3) as 1 | 2 | 3,
        text: heading[2],
        line: i,
      })
      continue
    }

    const task = TASK_RE.exec(line)
    if (task) {
      blocks.push({ kind: 'task', checked: task[2].toLowerCase() === 'x', text: task[3], line: i })
      continue
    }

    const radio = RADIO_RE.exec(line)
    if (radio) {
      blocks.push({
        kind: 'radio',
        checked: radio[2].toLowerCase() === 'x',
        text: radio[3],
        line: i,
        group: 0,
      })
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line)
      const rows: string[][] = []
      let end = i + 2
      while (end < lines.length && lines[end].trim() !== '' && lines[end].includes('|')) {
        rows.push(splitRow(lines[end]))
        end += 1
      }
      blocks.push({ kind: 'table', header, rows, line: i, endLine: end - 1 })
      i = end - 1
      continue
    }

    const quote = QUOTE_RE.exec(line)
    if (quote) {
      blocks.push({ kind: 'quote', text: quote[1], line: i })
      continue
    }

    if (ORDERED_RE.test(line)) {
      blocks.push({ kind: 'ordered', text: trimmed, line: i })
      continue
    }

    const bullet = BULLET_RE.exec(line)
    if (bullet) {
      blocks.push({ kind: 'bullet', text: bullet[2], line: i })
      continue
    }

    blocks.push({ kind: 'paragraph', text: line, line: i })
  }

  // Contiguous radio lines form one single-select group.
  let group = -1
  let previousRadioLine = -2
  for (const block of blocks) {
    if (block.kind !== 'radio') continue
    if (block.line !== previousRadioLine + 1) group += 1
    block.group = group
    previousRadioLine = block.line
  }

  return blocks
}

/** Flip `[ ]` and `[x]` on one source line. */
export function toggleTaskLine(content: string, line: number): string {
  const lines = content.split('\n')
  const current = lines[line]
  if (current == null) return content
  const match = TASK_RE.exec(current)
  if (!match) return content
  const next = match[2].toLowerCase() === 'x' ? ' ' : 'x'
  lines[line] = `${match[1]}- [${next}] ${match[3]}`
  return lines.join('\n')
}

/** Choose one radio line and clear the rest of its contiguous group. */
export function selectRadioLine(content: string, line: number): string {
  const lines = content.split('\n')
  if (!RADIO_RE.test(lines[line] ?? '')) return content

  let start = line
  let end = line
  while (start > 0 && RADIO_RE.test(lines[start - 1])) start -= 1
  while (end < lines.length - 1 && RADIO_RE.test(lines[end + 1])) end += 1

  for (let i = start; i <= end; i += 1) {
    const match = RADIO_RE.exec(lines[i])
    if (!match) continue
    const mark = i === line ? 'x' : ' '
    lines[i] = `${match[1]}- (${mark}) ${match[3]}`
  }
  return lines.join('\n')
}

/** Plain text for compact previews (notes list, collapsed event notes). */
export function stripMarkdownForSnippet(content: string): string {
  const text = content
    .replace(/!\[img:[a-fA-F0-9-]+\]/g, '[image]')
    .replace(/^\s*```.*$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^([ \t]*)[-*+]\s+\[[ xX]\]\s?/gm, '')
    .replace(/^([ \t]*)[-*+]\s+\([ xX]\)\s?/gm, '')
    .replace(/^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/gm, '')
    .replace(/^\s*\|/gm, '')
    .replace(/\|\s*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\s+/g, ' ')
    .trim()
  return text
}
