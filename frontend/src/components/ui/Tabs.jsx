import { panelId, tabId } from './tabIds'

/** Tab bar. Panels are rendered by the caller (kept mounted, hidden when inactive) using `panelId`. */

export default function Tabs({ tabs, value, onChange, label }) {
  const move = (event, index) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = tabs[(index + step + tabs.length) % tabs.length]
    onChange(next.id)
    document.getElementById(tabId(next.id))?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line print:hidden">
      {tabs.map(({ id, label: text, icon: Icon, badge }, index) => {
        const selected = id === value
        return (
          <button
            key={id}
            id={tabId(id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(event) => move(event, index)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              selected ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {text}
            {badge != null && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-normal text-muted">{badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
