// Each example fills the whole form: the trip's country, the three places and the cycle hours.
export const EXAMPLE_TRIPS = [
  {
    name: 'Short trip',
    values: {
      country: 'US',
      current: { place: 'Dallas', region: 'Texas' },
      pickup: { place: 'Fort Worth', region: 'Texas' },
      dropoff: { place: 'Austin', region: 'Texas' },
      current_cycle_used_hours: '10',
    },
  },
  {
    name: 'Multi-day',
    values: {
      country: 'US',
      current: { place: 'Los Angeles', region: 'California' },
      pickup: { place: 'Phoenix', region: 'Arizona' },
      dropoff: { place: 'Chicago', region: 'Illinois' },
      current_cycle_used_hours: '20',
    },
  },
  {
    name: 'Low cycle hours',
    values: {
      country: 'US',
      current: { place: 'Atlanta', region: 'Georgia' },
      pickup: { place: 'Nashville', region: 'Tennessee' },
      dropoff: { place: 'Columbus', region: 'Ohio' },
      current_cycle_used_hours: '66',
    },
  },
  {
    name: 'India trip',
    values: {
      country: 'IN',
      current: { place: 'Mumbai', region: 'Maharashtra' },
      pickup: { place: 'Pune', region: 'Maharashtra', area: 'Pune', postal: '411001' },
      dropoff: { place: 'Bengaluru', region: 'Karnataka', area: 'Bengaluru Urban', postal: '560001' },
      current_cycle_used_hours: '10',
    },
  },
]
