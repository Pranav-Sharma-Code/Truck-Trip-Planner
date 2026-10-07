import { MapPin } from 'lucide-react'
import { useState } from 'react'

import Header from './components/layout/Header'
import TripResults from './components/results/TripResults'
import TripForm from './components/trip-form/TripForm'
import Alert from './components/ui/Alert'
import Card from './components/ui/Card'
import { useApiStatus } from './hooks/useApiStatus'
import { usePlanTrip } from './hooks/usePlanTrip'
import { toRequest } from './lib/validation'

export default function App() {
  const apiStatus = useApiStatus()
  const { status, plan, error, run } = usePlanTrip()
  const [submitted, setSubmitted] = useState(null)

  const handleSubmit = (values) => {
    setSubmitted(values)
    run(toRequest(values))
  }

  // A new plan starts with nothing selected on the map or timeline.
  const planKey = plan ? `${plan.summary.start}|${plan.summary.arrival}|${plan.summary.total_miles}` : 'empty'

  return (
    <div className="min-h-screen bg-page text-ink">
      <Header apiStatus={apiStatus} />

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[380px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start print:hidden">
          <Card title="Trip details" icon={MapPin}>
            <TripForm loading={status === 'loading'} serverError={error} submitted={submitted} onSubmit={handleSubmit} />
          </Card>
        </aside>

        <section aria-label="Results" className="min-w-0 space-y-4 print:space-y-0">
          {error && (
            <Alert tone="error" title="Couldn't plan this trip">
              {error.message}
            </Alert>
          )}
          <TripResults key={planKey} plan={plan} loading={status === 'loading'} />
        </section>
      </main>
    </div>
  )
}
