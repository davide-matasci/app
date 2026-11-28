import {
  decodePlusCode,
  describeLocation,
  encodePlusCode,
  formatCoordinates,
  mapLinks,
  parseLocationText,
  parseShortPlusCode,
  pointToWorldPixels,
  recoverShortPlusCode,
  worldPixelsToPoint,
} from './Location'

describe('plus codes', () => {
  // From the Open Location Code test data
  it.each([
    [20.3700625, 2.7821875, '7FG49QCJ+2V'],
    [47.0000625, 8.0000625, '8FVC2222+22'],
    [-41.2730625, 174.7859375, '4VCPPQGP+Q9'],
    [90, 1, 'CFX3X2X2+X2'],
    [1, 180, '62H22222+22'],
  ])('encodes %p, %p as %s', (lat, lng, code) => {
    expect(encodePlusCode({ lat, lng })).toBe(code)
  })

  it('decodes a full code to the centre of its cell', () => {
    expect(decodePlusCode('7FG49QCJ+2V')).toEqual({ lat: 20.3700625, lng: 2.7821875 })
    expect(decodePlusCode('8fvc2222+22')).toEqual({ lat: 47.0000625, lng: 8.0000625 })
  })

  it('decodes codes longer than ten digits more precisely', () => {
    const point = decodePlusCode('7FG49QCJ+2VX')
    expect(point?.lat).toBeCloseTo(20.3701125, 6)
    expect(point?.lng).toBeCloseTo(2.782234375, 6)
  })

  it('rejects text that is not a full code', () => {
    expect(decodePlusCode('9QCJ+2V')).toBeNull()
    expect(decodePlusCode('7FG49QCJ+2A')).toBeNull()
    expect(decodePlusCode('hello')).toBeNull()
  })

  it('round-trips points all over the world', () => {
    for (const [lat, lng] of [
      [47.3769, 8.5417],
      [-33.8688, 151.2093],
      [0, 0],
      [-89.99, -179.99],
      [64.1466, -21.9426],
    ]) {
      const decoded = decodePlusCode(encodePlusCode({ lat, lng }))
      expect(Math.abs((decoded?.lat ?? 999) - lat)).toBeLessThan(0.0001)
      expect(Math.abs((decoded?.lng ?? 999) - lng)).toBeLessThan(0.0001)
    }
  })

  it('splits a short code from its locality', () => {
    expect(parseShortPlusCode('9G8F+6X Zürich, Switzerland')).toEqual({
      code: '9G8F+6X',
      locality: 'Zürich, Switzerland',
    })
    expect(parseShortPlusCode('cj+2v, Somewhere')).toEqual({ code: 'CJ+2V', locality: 'Somewhere' })
    expect(parseShortPlusCode('8FVC9G8F+6X')).toBeNull()
    expect(parseShortPlusCode('9G8F+6X')).toBeNull()
  })

  it('recovers a short code near a reference point', () => {
    // From the Open Location Code test data: 9C3W9QCJ+2VX
    const full = decodePlusCode('9C3W9QCJ+2V')
    expect(recoverShortPlusCode('9QCJ+2V', { lat: 51.3701125, lng: -1.217765625 })).toEqual(full)
    expect(recoverShortPlusCode('CJ+2V', { lat: 51.3708675, lng: -1.217765625 })).toEqual(full)
    // A reference in the neighbouring cell still gives the nearest match, not one in its own cell
    expect(recoverShortPlusCode('9QCJ+2V', { lat: 51.6, lng: -1.217765625 })).toEqual(full)
    expect(recoverShortPlusCode('nonsense', { lat: 0, lng: 0 })).toBeNull()
  })
})

describe('parseLocationText', () => {
  it.each([
    ['47.3769, 8.5417', 47.3769, 8.5417],
    ['47.3769 8.5417', 47.3769, 8.5417],
    ['(47.3769, 8.5417)', 47.3769, 8.5417],
    ['-33.8688, 151.2093', -33.8688, 151.2093],
    ['47,3769; 8,5417', 47.3769, 8.5417],
    ['47.3769° N, 8.5417° E', 47.3769, 8.5417],
    ['33.8688 S 151.2093 E', -33.8688, 151.2093],
    ['N 47.3769 E 8.5417', 47.3769, 8.5417],
    ['S 33.8688, W 70.5', -33.8688, -70.5],
    ['47°22\'36.8"N 8°32\'30.1"E', 47.3768889, 8.5416944],
    ['47° 22′ 36.8″ N, 8° 32′ 30.1″ E', 47.3768889, 8.5416944],
    ['N 47° 22.613 E 8° 32.502', 47.3768833, 8.5417],
    ['33°52\'7.7"S 151°12\'33.5"E', -33.8688056, 151.2093056],
  ])('reads %s', (text, lat, lng) => {
    const point = parseLocationText(text)
    expect(point?.lat).toBeCloseTo(lat, 6)
    expect(point?.lng).toBeCloseTo(lng, 6)
  })

  it('reads a full plus code, also inside other text', () => {
    expect(parseLocationText('8FVC2222+22')).toEqual({ lat: 47.0000625, lng: 8.0000625 })
    expect(parseLocationText('Meet at 8FVC2222+22 tomorrow')).toEqual({ lat: 47.0000625, lng: 8.0000625 })
  })

  it.each([
    ['https://www.google.com/maps/place/Z%C3%BCrich/@47.3769,8.5417,13z/data=!3m1!4b1', 47.3769, 8.5417],
    ['https://www.google.com/maps/place/X/@47.37,8.54,13z/data=!3d47.3769!4d8.5417', 47.3769, 8.5417],
    ['https://www.google.com/maps/search/?api=1&query=47.3769%2C8.5417', 47.3769, 8.5417],
    ['https://maps.google.com/?q=47.3769,8.5417', 47.3769, 8.5417],
    ['https://maps.apple.com/?ll=47.3769,8.5417&q=Home', 47.3769, 8.5417],
    ['https://www.openstreetmap.org/?mlat=47.3769&mlon=8.5417#map=17/47.3/8.5', 47.3769, 8.5417],
    ['https://www.openstreetmap.org/#map=17/47.3769/8.5417', 47.3769, 8.5417],
    ['geo:47.3769,8.5417?z=17', 47.3769, 8.5417],
  ])('reads the link %s', (text, lat, lng) => {
    expect(parseLocationText(text)).toEqual({ lat, lng })
  })

  it.each([
    [''],
    ['Zürich'],
    ['9G8F+6X Zürich'],
    ['95.0, 8.5'],
    ['47.3769, 190'],
    ['12, 34, 56'],
    ['call 044 123 45 67'],
    ['https://example.com/page?id=5'],
    ['1,5'],
  ])('does not read %p as a location', (text) => {
    expect(parseLocationText(text)).toBeNull()
  })
})

describe('formatting and links', () => {
  const point = { lat: 47.3769, lng: 8.5417 }

  it('formats coordinates and the description', () => {
    expect(formatCoordinates(point)).toBe('47.37690, 8.54170')
    expect(describeLocation(point)).toBe('47.37690, 8.54170, 8FVC9GGR+QM')
    expect(describeLocation(point, 'Home')).toBe('Home (47.37690, 8.54170, 8FVC9GGR+QM)')
  })

  it('links to the map apps', () => {
    expect(mapLinks(point, 'My place')).toEqual({
      apple: 'https://maps.apple.com/?ll=47.376900,8.541700&q=My%20place',
      google: 'https://www.google.com/maps/search/?api=1&query=47.376900,8.541700',
      openStreetMap: 'https://www.openstreetmap.org/?mlat=47.376900&mlon=8.541700#map=17/47.376900/8.541700',
    })
    expect(mapLinks(point).apple).toBe('https://maps.apple.com/?ll=47.376900,8.541700')
  })
})

describe('map positions', () => {
  it('puts 0, 0 in the middle of the world map', () => {
    expect(pointToWorldPixels({ lat: 0, lng: 0 }, 0)).toEqual({ x: 128, y: 128 })
  })

  it('round-trips a point through map pixels', () => {
    const point = { lat: 47.3769, lng: 8.5417 }
    const back = worldPixelsToPoint(pointToWorldPixels(point, 15), 15)
    expect(back.lat).toBeCloseTo(point.lat, 6)
    expect(back.lng).toBeCloseTo(point.lng, 6)
  })

  it('keeps positions on the map', () => {
    expect(worldPixelsToPoint({ x: 256 * 1.5, y: -50 }, 0).lng).toBeCloseTo(0, 6)
    expect(pointToWorldPixels({ lat: 90, lng: 0 }, 0).y).toBeCloseTo(0, 3)
  })
})
