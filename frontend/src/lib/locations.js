// A place in the form is a few parts; they are joined into one search text for the API.
export const LOCATION_KEYS = ['current', 'pickup', 'dropoff']

export const emptyLocation = () => ({ place: '', country: '', region: '', area: '', postal: '' })

export const emptyLocations = () => ({
  current: emptyLocation(),
  pickup: emptyLocation(),
  dropoff: emptyLocation(),
})

/** The place's own country if it has one, otherwise the trip's country ('' means anywhere). */
export const effectiveCountry = (location, tripCountry) => location.country || tripCountry || ''

/** "Pune, Pune, Maharashtra, 411001": the parts that are filled in, most specific first. */
export function composeQuery(location) {
  return [location.place, location.area, location.region, location.postal]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
}

export const hasDetails = (location) => Boolean(location.region || location.area || location.postal || location.country)
