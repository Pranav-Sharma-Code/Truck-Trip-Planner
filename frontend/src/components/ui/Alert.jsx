import { AlertTriangle, Info, XCircle } from 'lucide-react'

const TONES = {
  info: { icon: Info, box: 'border-line bg-surface-2 text-ink' },
  warn: { icon: AlertTriangle, box: 'border-warn-line bg-warn-soft text-warn' },
  error: { icon: XCircle, box: 'border-danger/30 bg-danger-soft text-danger' },
}

export default function Alert({ tone = 'info', title, children, action }) {
  const { icon: Icon, box } = TONES[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-lg border p-3.5 text-sm ${box}`}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
      {action}
    </div>
  )
}
