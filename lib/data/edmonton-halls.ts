export interface EdmontonHall {
  id: string
  name: string
  location: string
  area: number
}

export interface EdmontonHallSeed extends EdmontonHall {
  widthFt: number
  lengthFt: number
  latitude: number
  longitude: number
}

export const EDMONTON_HALLS: EdmontonHallSeed[] = [
  {
    id: 'edmonton-expo-centre',
    name: 'Edmonton Expo Centre',
    location: '7515 118 Avenue NW, Edmonton, AB',
    area: 72_000,
    widthFt: 240,
    lengthFt: 300,
    latitude: 53.5708,
    longitude: -113.4567,
  },
  {
    id: 'oasis-centre',
    name: 'Oasis Centre',
    location: '6804 99 Street NW, Edmonton, AB',
    area: 10_000,
    widthFt: 100,
    lengthFt: 100,
    latitude: 53.5056,
    longitude: -113.4867,
  },
  {
    id: 'lago-lindo-hall',
    name: 'Lago Lindo Community League Hall',
    location: '11424 167 Street NW, Edmonton, AB',
    area: 2_500,
    widthFt: 50,
    lengthFt: 50,
    latitude: 53.6123,
    longitude: -113.5989,
  },
  {
    id: 'kilkenny-hall',
    name: 'Kilkenny Community League Hall',
    location: '14907 71 Street NW, Edmonton, AB',
    area: 3_000,
    widthFt: 60,
    lengthFt: 50,
    latitude: 53.5989,
    longitude: -113.4567,
  },
  {
    id: 'highlands-hall',
    name: 'Highlands Community League Hall',
    location: '6112 113 Avenue NW, Edmonton, AB',
    area: 2_800,
    widthFt: 56,
    lengthFt: 50,
    latitude: 53.5678,
    longitude: -113.4234,
  },
  {
    id: 'bonnie-doon-hall',
    name: 'Bonnie Doon Community League Hall',
    location: '9240 92 Street NW, Edmonton, AB',
    area: 3_200,
    widthFt: 64,
    lengthFt: 50,
    latitude: 53.5234,
    longitude: -113.4567,
  },
]

export function getEdmontonHallById(id: string): EdmontonHallSeed | undefined {
  return EDMONTON_HALLS.find((hall) => hall.id === id)
}
