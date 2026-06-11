import {
  evaluateVenuePlaceTypes,
  evaluateVenueCoordinatesLocally,
  verifyVenueCoordinates,
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

async function runAsyncChecks() {
  const fromPlaces = await verifyVenueCoordinates({
    latitude: 53.54,
    longitude: -113.49,
    pinDropped: true,
    placeTypes: ['establishment', 'point_of_interest', 'food'],
  })
  assert('client place types verify without geocode', fromPlaces.verified)

  const prevKey = process.env.GOOGLE_MAPS_SERVER_API_KEY
  const prevPublic = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  process.env.GOOGLE_MAPS_SERVER_API_KEY = 'invalid-test-key'
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'invalid-test-key'
  const geocodeDenied = await verifyVenueCoordinates({
    latitude: 53.54,
    longitude: -113.49,
    pinDropped: true,
    address: '123 Test St, Edmonton, AB',
  })
  assert(
    'geocode auth failure mentions Geocoding API',
    !geocodeDenied.verified &&
      (geocodeDenied.reason?.includes('Geocoding API') ?? false)
  )
  if (prevKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY
  else process.env.GOOGLE_MAPS_SERVER_API_KEY = prevKey
  if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = prevPublic
}

runAsyncChecks()
  .then(() => {
    console.log('verify-venue-coordinates done')
  })
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
