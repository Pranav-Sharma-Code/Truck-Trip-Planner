export const LOCATION_KEYS = ['current', 'pickup', 'dropoff']

export const emptyLocation = () => ({ place: '', country: '', region: '', area: '', postal: '' })

export const emptyLocations = () => ({
  current: emptyLocation(),
  pickup: emptyLocation(),
  dropoff: emptyLocation(),
})

export const effectiveCountry = (location, tripCountry) => location.country || tripCountry || ''

export function composeQuery(location) {
  return [location.place, location.area, location.region, location.postal]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
}

export const hasDetails = (location) => Boolean(location.region || location.area || location.postal || location.country)
