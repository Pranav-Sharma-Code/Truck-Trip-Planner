export const inputClass = (hasError) =>
  `w-full min-h-10 rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-muted/70 transition ` +
  `focus:outline-none focus:ring-2 focus:ring-accent/40 ` +
  (hasError ? 'border-danger focus:border-danger' : 'border-line focus:border-accent')
