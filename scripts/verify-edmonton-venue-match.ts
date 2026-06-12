import { matchEdmontonVenuePreset } from '../lib/booth-planner/edmonton-venue-registry'

function assert(label: string, condition: boolean) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) process.exitCode = 1
}

assert(
  'matches by venue name',
  matchEdmontonVenuePreset({ venueName: 'Kilkenny Community League' }) === 'kilkenny'
)
assert(
  'matches by partial venue name',
  matchEdmontonVenuePreset({ venueName: 'Ritchie Community Hall' }) === 'ritchie'
)
assert(
  'matches by address',
  matchEdmontonVenuePreset({ address: '14907 71 Street NW, Edmonton, AB' }) === 'kilkenny'
)
assert(
  'matches by coordinates',
  matchEdmontonVenuePreset({ lat: 53.5989, lng: -113.4567 }) === 'kilkenny'
)
assert(
  'returns null for unknown venue',
  matchEdmontonVenuePreset({ venueName: 'Random Coffee Shop' }) === null
)

console.log('verify-edmonton-venue-match done')
