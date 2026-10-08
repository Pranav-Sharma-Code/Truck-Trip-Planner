import { Truck } from 'lucide-react'

import ThemeToggle from './ThemeToggle'

const STATUS = {
  checking: { text: 'Connecting', dot: 'bg-muted' },
  waking: { text: 'Waking up the server', dot: 'bg-warn animate-pulse' },
  online: { text: 'Server online', dot: 'bg-ok' },
  offline: { text: 'Server unreachable', dot: 'bg-danger' },
}

export default function Header({ apiStatus, theme }) {
  const { text, dot } = STATUS[apiStatus]
  return (
    <header className="border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">
            <Truck size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-base font-semibold text-ink">HOS Trip Planner</h1>
            <p className="truncate text-xs text-muted">Property carrier · 70 hr / 8 day</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <p className="flex items-center gap-2 text-xs text-muted" role="status">
            <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
            <span className="hidden sm:inline">{text}</span>
            <span className="sr-only sm:hidden">{text}</span>
          </p>
          <ThemeToggle preference={theme.preference} onChange={theme.choose} />
        </div>
      </div>
    </header>
  )
}
