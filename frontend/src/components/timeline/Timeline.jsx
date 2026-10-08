import { formatDate } from '../../lib/format'
import { groupEventsByDay } from '../../lib/tripView'
import TimelineItem from './TimelineItem'

export default function Timeline({ events, selection, onSelect }) {
  const days = groupEventsByDay(events)

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.date} aria-label={`Day ${day.number}`}>
          <h3 className="mb-1.5 
                         flex 
                         items-center 
                         gap-2 
                         px-3 
                         text-xs 
                         font-semibold 
                         uppercase 
                         tracking-wide 
                         text-muted">
            Day {day.number}
            <span className="font-normal normal-case tracking-normal">{formatDate(day.date)}</span>
          </h3>
          <ol className="space-y-0.5">
            {day.events.map((event) => (
              <TimelineItem
                key={event.id}
                event={event}
                selected={selection?.id === event.id}
                scrollIntoView={selection?.fly === false}
                onSelect={(id) => onSelect({ id, fly: true })}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
