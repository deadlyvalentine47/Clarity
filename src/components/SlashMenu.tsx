import type { CSSProperties } from 'react'
import type { SlashCommand } from '../lib/slashCommands'

export function SlashMenu({
  items,
  activeIndex,
  onPick,
  onHover,
  style,
}: {
  items: readonly SlashCommand[]
  activeIndex: number
  onPick: (command: SlashCommand) => void
  onHover: (index: number) => void
  style?: CSSProperties
}) {
  return (
    <div className="slash-menu" role="listbox" aria-label="Insert block" style={style}>
      {items.length === 0 ? (
        <div className="slash-menu-empty">No matching command</div>
      ) : (
        items.map((command, index) => (
          <button
            key={command.id}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={`slash-menu-item ${index === activeIndex ? 'active' : ''}`}
            onMouseEnter={() => onHover(index)}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onPick(command)}
          >
            <span className="slash-menu-label">{command.label}</span>
            <span className="slash-menu-id">/{command.id}</span>
            <span className="slash-menu-hint">{command.hint}</span>
          </button>
        ))
      )}
    </div>
  )
}
