import { EXAMPLE_TRIPS } from '../../lib/examples'

export default function ExampleTrips({ onPick, disabled }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Try an example</p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_TRIPS.map((example) => (
          <button
            key={example.name}
            type="button"
            disabled={disabled}
            onClick={() => onPick(example.values)}
            className="rounded-full 
                       border 
                       border-line 
                       bg-surface 
                       px-3 py-1.5 
                       text-xs 
                       font-medium 
                       text-ink 
                       transition 
                       hover:bg-surface-2 
                       disabled:cursor-not-allowed 
                       disabled:opacity-60"
          >
            {example.name}
          </button>
        ))}
      </div>
    </div>
  )
}
