import {
  evaluateVenuePlaceTypes,
  evaluateVenueCoordinatesLocally,
  hasCompleteVenuePin,
  verifyVenueCoordinates,
  isNamedPublicEventSpace,
} from '../lib/venues/verify-venue-coordinates'

function assert(label: string, condition: boolean) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) process.exitCode = 1
}

async function main() {
  const commercial = evaluateVenuePlaceTypes(['establishment', 'point_of_interest', 'food'])
  assert('commercial establishment verifies', commercial.verified)

  const park = evaluateVenuePlaceTypes(['park', 'locality', 'political'])
  assert('public park verifies', park.verified)

  const streetOnly = evaluateVenuePlaceTypes(['street_address', 'route'])
  assert('street only rejects without pin context', !streetOnly.verified)

  assert(
    'pin and address accepts street-only geocode types',
    hasCompleteVenuePin({
      latitude: 53.5,
      longitude: -113.5,
      address: '123 Main Street NW, Edmonton, AB',
      pinDropped: true,
    })
  )

  assert(
    'community league name detected',
    isNamedPublicEventSpace('Kilkenny Community League Hall')
  )

  const leagueHall = await verifyVenueCoordinates({
    latitude: 53.5989,
    longitude: -113.4567,
    address: '14907 71 Street NW, Edmonton, AB',
    locationName: 'Kilkenny Community League',
    pinDropped: true,
  })
  assert('named community league hall verifies', leagueHall.verified)

  const premiseInLaterResult = evaluateVenuePlaceTypes(['premise', 'street_address'])
  assert('premise with street address verifies', premiseInLaterResult.verified)

  const zeroCoords = evaluateVenueCoordinatesLocally({ latitude: 0, longitude: 0, pinDropped: true })
  assert('zero coords reject', zeroCoords != null && !zeroCoords.verified)

  const noPin = evaluateVenueCoordinatesLocally({ latitude: 53.5, longitude: -113.5, pinDropped: false })
  assert('no pin pending', noPin != null && noPin.status === 'pending')

  console.log('verify-venue-coordinates done')
}

void main()
