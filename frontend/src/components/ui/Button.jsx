import Spinner from './Spinner'

const VARIANTS = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 disabled:opacity-60',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-60',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-60',
}

export default function Button({ variant = 'primary', loading = false, icon: Icon, children, className = '', ...props }) {
  return (
    <button
      type="button"
      disabled={loading || props.disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading ? <Spinner size={16} /> : Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  )
}
