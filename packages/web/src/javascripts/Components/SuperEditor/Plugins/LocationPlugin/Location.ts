/**
 * Location maths for the Super "Location" block: plus codes (Open Location Code), parsing of typed or
 * pasted coordinates and map links, links to map apps, and map tile positions. No network, no dependencies.
 */

export type GeoPoint = { lat: number; lng: number }

const PLUS_CODE_ALPHABET = '23456789CFGHJMPQRVWX'
const PLUS_CODE_CHARS = '[23456789CFGHJMPQRVWX]'
/** 1 / 0.000125°: the size of a 10-digit plus code cell (about 14 m). */
const PLUS_CODE_PRECISION = 8000
const FULL_PLUS_CODE = new RegExp(
  `(?:^|[^0-9A-Za-z+])(${PLUS_CODE_CHARS}{8}\\+${PLUS_CODE_CHARS}{2,7})(?![0-9A-Za-z+])`,
  'i',
)
const SHORT_PLUS_CODE = new RegExp(
  `^\\s*(${PLUS_CODE_CHARS}{2}|${PLUS_CODE_CHARS}{4}|${PLUS_CODE_CHARS}{6})\\+(${PLUS_CODE_CHARS}{2,3})[\\s,]+(\\S.*)$`,
  'i',
)

export function isValidPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  )
}

/** The 10-digit plus code of a point, e.g. "8FVC9G8F+6X". */
export function encodePlusCode(point: GeoPoint): string {
  const lat = Math.min(Math.max(point.lat, -90), 90)
  let lng = point.lng
  while (lng < -180) {
    lng += 360
  }
  while (lng >= 180) {
    lng -= 360
  }
  // Whole numbers of cells from the south pole / the antimeridian; the pole itself belongs to the last cell.
  let latCells = Math.min(
    Math.floor(Math.round((lat + 90) * PLUS_CODE_PRECISION * 1e6) / 1e6),
    180 * PLUS_CODE_PRECISION - 1,
  )
  let lngCells = Math.floor(Math.round((lng + 180) * PLUS_CODE_PRECISION * 1e6) / 1e6)

  let code = ''
  for (let pair = 0; pair < 5; pair++) {
    code = PLUS_CODE_ALPHABET[latCells % 20] + PLUS_CODE_ALPHABET[lngCells % 20] + code
    latCells = Math.floor(latCells / 20)
    lngCells = Math.floor(lngCells / 20)
  }
  return `${code.slice(0, 8)}+${code.slice(8)}`
}

/** The centre of a full plus code's cell, or null if it isn't a valid full code. */
export function decodePlusCode(code: string): GeoPoint | null {
  const match = new RegExp(`^(${PLUS_CODE_CHARS}{8})\\+(${PLUS_CODE_CHARS}{2,7})$`, 'i').exec(code.trim())
  if (!match) {
    return null
  }
  const digits = (match[1] + match[2]).toUpperCase()
  let lat = -90
  let lng = -180
  let latSize = 400
  let lngSize = 400
  for (let index = 0; index < 10; index += 2) {
    latSize /= 20
    lngSize /= 20
    lat += PLUS_CODE_ALPHABET.indexOf(digits[index]) * latSize
    lng += PLUS_CODE_ALPHABET.indexOf(digits[index + 1]) * lngSize
  }
  // Digits after the tenth each divide the cell into a grid of 5 rows and 4 columns.
  for (let index = 10; index < digits.length; index++) {
    const value = PLUS_CODE_ALPHABET.indexOf(digits[index])
    latSize /= 5
    lngSize /= 4
    lat += Math.floor(value / 4) * latSize
    lng += (value % 4) * lngSize
  }
  if (lat >= 90) {
    return null
  }
  return { lat: roundDegrees(lat + latSize / 2), lng: roundDegrees(lng + lngSize / 2) }
}

/** A short plus code with its locality, e.g. "9G8F+6X Zürich": the code and the place to look up. */
export function parseShortPlusCode(text: string): { code: string; locality: string } | null {
  const match = SHORT_PLUS_CODE.exec(text)
  if (!match) {
    return null
  }
  return { code: `${match[1]}+${match[2]}`.toUpperCase(), locality: match[3].trim() }
}

/** The full-code location a short plus code refers to, near a reference point (its locality). */
export function recoverShortPlusCode(shortCode: string, reference: GeoPoint): GeoPoint | null {
  const code = shortCode.trim().toUpperCase()
  const separator = code.indexOf('+')
  if (separator < 0 || separator >= 8 || separator % 2 !== 0) {
    return null
  }
  const missing = 8 - separator
  const point = decodePlusCode(encodePlusCode(reference).slice(0, missing) + code)
  if (!point) {
    return null
  }
  // The code is the nearest match to the reference: at most half the missing digits' cell size away.
  const size = Math.pow(20, 2 - missing / 2)
  const half = size / 2
  let { lat, lng } = point
  if (reference.lat + half < lat && lat - size >= -90) {
    lat -= size
  } else if (reference.lat - half > lat && lat + size <= 90) {
    lat += size
  }
  if (reference.lng + half < lng) {
    lng -= size
  } else if (reference.lng - half > lng) {
    lng += size
  }
  return { lat: roundDegrees(lat), lng: roundDegrees(lng) }
}

const NUMBER = '-?\\d{1,3}(?:[.,]\\d+)?'
const DECIMAL_NUMBER = '-?\\d{1,3}(?:\\.\\d+)?'

/**
 * Coordinates, a full plus code or a map link in typed or pasted text, converted without any network:
 * "47.3769, 8.5417", "47.3769° N, 8.5417° E", "N 47.3769 E 8.5417", "47°22'36.8\"N 8°32'30.1\"E",
 * "8FVC9G8F+6X", and Google Maps, Apple Maps, OpenStreetMap and geo: links that contain coordinates.
 */
export function parseLocationText(text: string): GeoPoint | null {
  const input = text.trim()
  if (!input) {
    return null
  }
  return firstValid([parseMapLink(input), parsePlusCodeIn(input), parseDms(input), parseDecimal(input)])
}

function firstValid(points: Array<GeoPoint | null>): GeoPoint | null {
  for (const point of points) {
    if (point && isValidPoint(point)) {
      return { lat: roundDegrees(point.lat), lng: roundDegrees(point.lng) }
    }
  }
  return null
}

function parsePlusCodeIn(input: string): GeoPoint | null {
  const match = FULL_PLUS_CODE.exec(input)
  return match ? decodePlusCode(match[1]) : null
}

function parseMapLink(input: string): GeoPoint | null {
  if (!/^(https?:\/\/|geo:)/i.test(input)) {
    return null
  }
  const pair = `(${DECIMAL_NUMBER}),\\s*(${DECIMAL_NUMBER})`
  const patterns = [
    new RegExp(`^geo:${pair}`, 'i'),
    // Google Maps: the pin (!3d..!4d..) is more exact than the viewport centre (@lat,lng)
    new RegExp(`!3d(${DECIMAL_NUMBER})!4d(${DECIMAL_NUMBER})`),
    new RegExp(`[?&](?:q|query|ll|sll|center|destination|daddr|loc)=(?:loc:)?${pair}`, 'i'),
    new RegExp(`[?&]mlat=(${DECIMAL_NUMBER})&mlon=(${DECIMAL_NUMBER})`, 'i'),
    new RegExp(`/@${pair}`),
    new RegExp(`#map=\\d+(?:\\.\\d+)?/(${DECIMAL_NUMBER})/(${DECIMAL_NUMBER})`),
    new RegExp(`/(?:place|search)/${pair}`),
  ]
  let decoded = input
  try {
    decoded = decodeURIComponent(input)
  } catch {
    // keep the text as it is
  }
  for (const pattern of patterns) {
    const match = pattern.exec(decoded)
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }
    }
  }
  return null
}

/** Degrees with minutes and optional seconds, each coordinate with its hemisphere letter. */
function parseDms(input: string): GeoPoint | null {
  const part =
    "(\\d{1,3})\\s*[°ºd\\s]\\s*(\\d{1,2}(?:[.,]\\d+)?)\\s*['′m]?\\s*(?:(\\d{1,2}(?:[.,]\\d+)?)\\s*(?:\"|″|''|s)?)?"
  const hemisphereFirst = new RegExp(`^([NS])\\s*${part}[\\s,;]*([EWO])\\s*${part}$`, 'i').exec(input)
  if (hemisphereFirst) {
    const [, latSide, latD, latM, latS, lngSide, lngD, lngM, lngS] = hemisphereFirst
    return {
      lat: dmsToDegrees(latD, latM, latS, latSide),
      lng: dmsToDegrees(lngD, lngM, lngS, lngSide),
    }
  }
  const hemisphereLast = new RegExp(`^${part}\\s*([NS])[\\s,;]*${part}\\s*([EWO])$`, 'i').exec(input)
  if (hemisphereLast) {
    const [, latD, latM, latS, latSide, lngD, lngM, lngS, lngSide] = hemisphereLast
    return {
      lat: dmsToDegrees(latD, latM, latS, latSide),
      lng: dmsToDegrees(lngD, lngM, lngS, lngSide),
    }
  }
  return null
}

function dmsToDegrees(degrees: string, minutes: string, seconds: string | undefined, side: string): number {
  const value = toNumber(degrees) + toNumber(minutes) / 60 + (seconds ? toNumber(seconds) / 3600 : 0)
  return /[SW]/i.test(side) ? -value : value
}

/** Decimal degrees: "47.3769, 8.5417", with optional ° and hemisphere letters before or after. */
function parseDecimal(input: string): GeoPoint | null {
  const hemisphereLast = new RegExp(`^(${NUMBER})\\s*°?\\s*([NS])[\\s,;]+(${NUMBER})\\s*°?\\s*([EWO])$`, 'i').exec(
    input,
  )
  if (hemisphereLast) {
    return {
      lat: withSide(hemisphereLast[1], hemisphereLast[2]),
      lng: withSide(hemisphereLast[3], hemisphereLast[4]),
    }
  }
  const hemisphereFirst = new RegExp(`^([NS])\\s*(${NUMBER})\\s*°?[\\s,;]+([EWO])\\s*(${NUMBER})\\s*°?$`, 'i').exec(
    input,
  )
  if (hemisphereFirst) {
    return {
      lat: withSide(hemisphereFirst[2], hemisphereFirst[1]),
      lng: withSide(hemisphereFirst[4], hemisphereFirst[3]),
    }
  }
  // Without letters: latitude first. A decimal comma is only accepted when another separator divides the
  // pair, and two whole numbers ("1,5", "12, 34") are more likely something else than coordinates.
  const withPoints = new RegExp(
    `^\\(?\\s*(${DECIMAL_NUMBER})\\s*°?\\s*[,;\\s]\\s*(${DECIMAL_NUMBER})\\s*°?\\s*\\)?$`,
  ).exec(input)
  if (withPoints && (withPoints[1].includes('.') || withPoints[2].includes('.'))) {
    return { lat: toNumber(withPoints[1]), lng: toNumber(withPoints[2]) }
  }
  const withCommas = new RegExp('^(-?\\d{1,3},\\d+)\\s*°?\\s*[;\\s]\\s*(-?\\d{1,3},\\d+)\\s*°?$').exec(input)
  if (withCommas) {
    return { lat: toNumber(withCommas[1]), lng: toNumber(withCommas[2]) }
  }
  return null
}

function withSide(value: string, side: string): number {
  const number = Math.abs(toNumber(value))
  return /[SW]/i.test(side) ? -number : number
}

function toNumber(value: string): number {
  return parseFloat(value.replace(',', '.'))
}

function roundDegrees(value: number): number {
  return Math.round(value * 1e7) / 1e7
}

/** "47.37690, 8.54170": five decimals are about one metre. */
export function formatCoordinates(point: GeoPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
}

/** One line for exports and plain text: "Name (47.37690, 8.54170, 8FVC9G8F+6X)". */
export function describeLocation(point: GeoPoint, name?: string): string {
  const details = `${formatCoordinates(point)}, ${encodePlusCode(point)}`
  return name ? `${name} (${details})` : details
}

export function mapLinks(point: GeoPoint, name?: string): { apple: string; google: string; openStreetMap: string } {
  const lat = point.lat.toFixed(6)
  const lng = point.lng.toFixed(6)
  const label = name ? `&q=${encodeURIComponent(name)}` : ''
  return {
    apple: `https://maps.apple.com/?ll=${lat},${lng}${label}`,
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    openStreetMap: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
  }
}

export const MAP_TILE_SIZE = 256
export const MAP_MIN_ZOOM = 2
export const MAP_MAX_ZOOM = 19
const MAX_MERCATOR_LATITUDE = 85.05112878

/** Position of a point on the square world map of a zoom level, in pixels from its top-left corner. */
export function pointToWorldPixels(point: GeoPoint, zoom: number): { x: number; y: number } {
  const size = MAP_TILE_SIZE * Math.pow(2, zoom)
  const lat = Math.min(Math.max(point.lat, -MAX_MERCATOR_LATITUDE), MAX_MERCATOR_LATITUDE)
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((point.lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  }
}

export function worldPixelsToPoint(pixels: { x: number; y: number }, zoom: number): GeoPoint {
  const size = MAP_TILE_SIZE * Math.pow(2, zoom)
  const y = Math.min(Math.max(pixels.y, 0), size)
  let lng = (pixels.x / size) * 360 - 180
  lng = ((((lng + 180) % 360) + 360) % 360) - 180
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / size))) * 180) / Math.PI
  return { lat: roundDegrees(lat), lng: roundDegrees(lng) }
}
