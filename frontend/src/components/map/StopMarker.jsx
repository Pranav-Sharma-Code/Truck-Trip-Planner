import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { Marker, Popup } from 'react-leaflet'

import { EVENT_TYPES, START_MARKER } from '../../lib/eventTypes'

const SIZE = 30

function makeIcon(type, selected) {
  const meta = type === 'START' ? START_MARKER : EVENT_TYPES[type]
  const inner = meta.pin ?? renderToStaticMarkup(<meta.icon size={15} strokeWidth={2.4} aria-hidden="true" />)
  return L.divIcon({
    className: '',
    html: `<div class="stop-marker${selected ? ' is-selected' : ''}" style="--marker-color:${meta.color}">${inner}</div>`,
    iconSize: [SIZE, SIZE],
    iconAnchor: [SIZE / 2, SIZE / 2],
    popupAnchor: [0, -SIZE / 2],
  })
}

export default function StopMarker({ marker, selected, onSelect, registerRef }) {
  return (
    <Marker
      position={marker.position}
      icon={makeIcon(marker.type, selected)}
      ref={(instance) => registerRef(marker.id, instance)}
      eventHandlers={{ click: () => onSelect(marker.id) }}
    >
      <Popup>
        <p className="m-0 text-sm font-semibold">{marker.title}</p>
        {marker.time && <p className="m-0 mt-0.5 text-xs opacity-80">{marker.time}</p>}
        <p className="m-0 mt-1 text-xs">{marker.detail}</p>
        <p className="m-0 mt-1.5 text-xs opacity-80">{marker.reason}</p>
      </Popup>
    </Marker>
  )
}
