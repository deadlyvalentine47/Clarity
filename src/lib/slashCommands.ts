import { toDateKey } from './dates'

export interface SlashCommand {
  id: string
  label: string
  hint: string
  keywords?: readonly string[]
  /** Text that replaces the typed `/query`, or a lazy value (e.g. today's date). */
  insert: string | (() => string)
  /** Distance from the end of the inserted text to place the caret. */
  caretOffset?: number
  /** Handled by the surface instead of inserting text (e.g. image picker). */
  actionId?: string
}

export const TEXT_COMMANDS: readonly SlashCommand[] = [
  {
    id: 'todo',
    label: 'To-do',
    hint: 'Checklist item with a tickable box',
    keywords: ['task', 'checkbox', 'check'],
    insert: '- [ ] ',
  },
  {
    id: 'radio',
    label: 'Single choice',
    hint: 'Pick one option from a group',
    keywords: ['radio', 'choice', 'option'],
    insert: '- ( ) ',
  },
  {
    id: 'table',
    label: 'Table',
    hint: 'Rows and columns',
    keywords: ['grid', 'columns'],
    insert:
      '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |',
  },
  { id: 'heading', label: 'Heading', hint: 'Large section heading', insert: '## ' },
  { id: 'subheading', label: 'Subheading', hint: 'Smaller heading', insert: '### ' },
  { id: 'bullet', label: 'Bullet', hint: 'Bulleted list item', keywords: ['list'], insert: '- ' },
  {
    id: 'numbered',
    label: 'Numbered list',
    hint: 'Ordered list item',
    keywords: ['ordered', 'list'],
    insert: '1. ',
  },
  { id: 'quote', label: 'Quote', hint: 'Indented quotation', insert: '> ' },
  {
    id: 'code',
    label: 'Code block',
    hint: 'Monospaced, preserved spacing',
    keywords: ['pre', 'snippet'],
    insert: '```\n\n```',
    caretOffset: 4,
  },
  { id: 'divider', label: 'Divider', hint: 'Horizontal line', keywords: ['hr', 'line'], insert: '---' },
  {
    id: 'today',
    label: 'Today’s date',
    hint: 'Insert YYYY-MM-DD',
    keywords: ['date', 'now'],
    insert: () => toDateKey(new Date()),
  },
]

export const NOTE_COMMANDS: readonly SlashCommand[] = [
  ...TEXT_COMMANDS,
  {
    id: 'image',
    label: 'Image',
    hint: 'Attach a picture',
    keywords: ['photo', 'picture', 'attachment'],
    insert: '',
    actionId: 'image',
  },
]

export function filterCommands(
  commands: readonly SlashCommand[],
  query: string,
): SlashCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...commands]
  return commands.filter(
    (command) =>
      command.id.toLowerCase().startsWith(q) ||
      command.label.toLowerCase().includes(q) ||
      (command.keywords ?? []).some((keyword) => keyword.toLowerCase().startsWith(q)),
  )
}
