import {
  evaluateVenuePlaceTypes,
  evaluateVenueCoordinatesLocally,
} from '../lib/venues/verify-venue-coordinates'

function assert(label: string, condition: boolean) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) process.exitCode = 1
}

const commercial = evaluateVenuePlaceTypes(['establishment', 'point_of_interest', 'food'])
assert('commercial establishment verifies', commercial.verified)

const park = evaluateVenuePlaceTypes(['park', 'locality', 'political'])
assert('public park verifies', park.verified)

const streetOnly = evaluateVenuePlaceTypes(['street_address', 'route'])
assert('street only rejects', !streetOnly.verified)

const zeroCoords = evaluateVenueCoordinatesLocally({ latitude: 0, longitude: 0, pinDropped: true })
assert('zero coords reject', zeroCoords != null && !zeroCoords.verified)

const noPin = evaluateVenueCoordinatesLocally({ latitude: 53.5, longitude: -113.5, pinDropped: false })
assert('no pin pending', noPin != null && noPin.status === 'pending')

console.log('verify-venue-coordinates done')
