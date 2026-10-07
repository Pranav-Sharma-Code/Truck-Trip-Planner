import { Truck } from 'lucide-react'

const STATUS = {
  checking: { text: 'Connecting', dot: 'bg-muted' },
  waking: { text: 'Waking up the server', dot: 'bg-warn animate-pulse' },
  online: { text: 'Server online', dot: 'bg-ok' },
  offline: { text: 'Server unreachable', dot: 'bg-danger' },
}

export default function Header({ apiStatus }) {
  const { text, dot } = STATUS[apiStatus]
  return (
    <header className="border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-ink">
            <Truck size={20} aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-semibold text-ink">HOS Trip Planner</h1>
            <p className="text-xs text-muted">Property carrier · 70 hr / 8 day</p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted" role="status">
          <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
          {text}
        </p>
      </div>
    </header>
  )
}
