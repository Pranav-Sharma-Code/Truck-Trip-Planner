import { FileText, ListOrdered, Route, ShieldCheck } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { buildMarkers } from '../../lib/tripView'
import AuditPanel from '../audit/AuditPanel'
import LogSheetList from '../logs/LogSheetList'
import MapLegend from '../map/MapLegend'
import RouteMap from '../map/RouteMap'
import TripSummary from '../summary/TripSummary'
import Timeline from '../timeline/Timeline'
import Alert from '../ui/Alert'
import Card from '../ui/Card'
import Tabs from '../ui/Tabs'
import { panelId, tabId } from '../ui/tabIds'

const WARNING_TITLES = {
  restart_scheduled: '34-hour restart scheduled',
  cycle_exhausted_at_start: '34-hour restart before departure',
}

function Panel({ id, active, children }) {
  return (
    <div id={panelId(id)} role="tabpanel" aria-labelledby={tabId(id)} hidden={!active} 
         className="space-y-4 pt-4 print:pt-0">
      {children}
    </div>
  )
}

export default function TripResults({ plan, loading }) {
  const [tab, setTab] = useState('route')
  const [selection, setSelection] = useState(null)
  const mapRef = useRef(null)
  const markers = useMemo(() => (plan ? buildMarkers(plan) : []), [plan])
  const present = useMemo(() => new Set(markers.map((marker) => marker.type)), [markers])

  const selectFromTimeline = (next) => {
    setSelection(next)
    const rect = mapRef.current?.getBoundingClientRect()
    if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) {
      mapRef.current.scrollIntoView({ block: 'start' })
    }
  }

  const map = (
    <div ref={mapRef} className="scroll-mt-4">
      <Card title="Route" icon={Route} bodyClassName="space-y-3 p-3">
        <RouteMap
          plan={plan}
          markers={markers}
          selection={selection}
          onSelect={setSelection}
          className="h-[min(60vh,520px)] min-h-90"
        />
        {plan && <MapLegend present={present} />}
      </Card>
    </div>
  )

  if (!plan) return <div className={loading ? 'opacity-60 transition-opacity' : ''}>{map}</div>

  const tabs = [
    { id: 'route', label: 'Route & stops', icon: Route },
    { id: 'logs', label: 'Daily logs', icon: FileText, badge: plan.daily_logs.length },
    { id: 'audit', label: 'HOS audit', icon: ShieldCheck },
  ]

  return (
    <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <div className="space-y-4 print:hidden">
        <TripSummary plan={plan} />
        {plan.warnings.map((warning) => (
          <Alert key={warning.code} tone="warn" title={WARNING_TITLES[warning.code]}>
            {warning.message}
          </Alert>
        ))}
      </div>

      <div className="mt-4">
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Trip results" />

        <Panel id="route" active={tab === 'route'}>
          {map}
          <Card title="Trip timeline" icon={ListOrdered} bodyClassName="p-2 sm:p-3">
            <Timeline events={plan.events} selection={selection} onSelect={selectFromTimeline} />
          </Card>
        </Panel>

        <Panel id="logs" active={tab === 'logs'}>
          <LogSheetList plan={plan} />
        </Panel>

        <Panel id="audit" active={tab === 'audit'}>
          <AuditPanel plan={plan} />
        </Panel>
      </div>
    </div>
  )
}
