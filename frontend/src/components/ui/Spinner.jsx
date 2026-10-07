import { Loader2 } from 'lucide-react'

export default function Spinner({ size = 20, label }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
      <Loader2 size={size} className="animate-spin" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  )
}
