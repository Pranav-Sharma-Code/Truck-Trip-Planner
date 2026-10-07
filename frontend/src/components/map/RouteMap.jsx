import 'leaflet/dist/leaflet.css'

import { useEffect, useRef } from 'react'
import { MapContainer, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'

import { eventBounds } from '../../lib/tripView'
import StopMarker from './StopMarker'

const US_CENTER = [39.5, -98.35]
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const FOCUS_ZOOM = 9

// Wheel zoom would hijack page scrolling, so it is switched on by clicking the map and off when the mouse leaves.
function WheelZoomOnClick() {
  const map = useMapEvents({
    click: () => map.scrollWheelZoom.enable(),
    mouseout: () => map.scrollWheelZoom.disable(),
  })
  return null
}

// The map lives in a panel that can be hidden and shown again; Leaflet must be told when its size changes.
function ResizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

function FitRoute({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) map.fitBounds(positions, { padding: [40, 40] })
  }, [map, positions])
  return null
}

// Moves the map to the selected timeline item, then opens its popup if it has a marker.
function FocusSelection({ selection, events, markerRefs }) {
  const map = useMap()
  useEffect(() => {
    if (!selection?.fly) return
    const marker = markerRefs.current[selection.id]
    if (marker) {
      map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.8 })
      map.once('moveend', () => marker.openPopup())
      return
    }
    const event = events.find((item) => item.id === selection.id)
    if (event) map.flyToBounds(eventBounds(event), { padding: [60, 60], duration: 0.8 })
  }, [map, selection, events, markerRefs])
  return null
}

/**
 * `plan` is optional: without one this is just the empty map. `selection` is `{id, fly}`; `fly` is true
 * when the choice came from the timeline, so the map should move, and false when a marker was clicked.
 */
export default function RouteMap({ plan, markers = [], selection, onSelect, className = '' }) {
  const markerRefs = useRef({})
  const positions = plan?.route.geometry

  const registerRef = (id, instance) => {
    if (instance) markerRefs.current[id] = instance
    else delete markerRefs.current[id]
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-line ${className}`}>
      <MapContainer center={US_CENTER} zoom={4} scrollWheelZoom={false} className="size-full" style={{ minHeight: 360 }}>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
        <WheelZoomOnClick />
        <ResizeWatcher />
        {positions && (
          <>
            <Polyline positions={positions} pathOptions={{ className: 'route-line', weight: 5, opacity: 0.9 }} />
            <FitRoute positions={positions} />
            {markers.map((marker) => (
              <StopMarker
                key={marker.id}
                marker={marker}
                selected={selection?.id === marker.id}
                onSelect={(id) => onSelect({ id, fly: false })}
                registerRef={registerRef}
              />
            ))}
            <FocusSelection selection={selection} events={plan.events} markerRefs={markerRefs} />
          </>
        )}
      </MapContainer>
      {!plan && (
        <p className="pointer-events-none absolute inset-x-0 bottom-6 z-500 mx-auto w-fit rounded-full border border-line bg-surface px-4 py-2 text-sm text-muted shadow">
          Enter a trip to see the route and every stop on it
        </p>
      )}
    </div>
  )
}
