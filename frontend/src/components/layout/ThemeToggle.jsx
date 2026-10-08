import { Monitor, Moon, Sun } from 'lucide-react'

const OPTIONS = [
  { id: 'light', label: 'Light', icon: Sun, hint: 'Light theme' },
  { id: 'dark', label: 'Dark', icon: Moon, hint: 'Dark theme' },
  { id: 'system', label: 'System', icon: Monitor, hint: 'Match your device setting' },
]

export default function ThemeToggle({ preference, onChange }) {
  const move = (event, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = OPTIONS[(index + step + OPTIONS.length) % OPTIONS.length]
    onChange(next.id)
    document.getElementById(`theme-${next.id}`)?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {OPTIONS.map(({ id, label, icon: Icon, hint }, index) => {
        const selected = preference === id
        return (
          <button
            key={id}
            id={`theme-${id}`}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={hint}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(event) => move(event, index)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              selected ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
