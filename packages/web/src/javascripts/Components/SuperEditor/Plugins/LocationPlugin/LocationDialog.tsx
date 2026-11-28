import Button from '@/Components/Button/Button'
import DecoratedInput from '@/Components/Input/DecoratedInput'
import { isMobileScreen } from '@/Utils'
import { useCallback, useState } from 'react'
import { c } from 'ttag'
import {
  encodePlusCode,
  formatCoordinates,
  GeoPoint,
  parseLocationText,
  parseShortPlusCode,
  recoverShortPlusCode,
} from './Location'
import LocationMap from './LocationMap'
import type { LocationPayload } from './LocationNode'

type SearchResult = { name: string; description: string; point: GeoPoint }

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

/** Places matching a name or address, from OpenStreetMap's search service. Only called when the user asks. */
async function searchPlaces(query: string): Promise<SearchResult[]> {
  const response = await fetch(`${SEARCH_URL}?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Search failed (${response.status})`)
  }
  const places = (await response.json()) as { lat: string; lon: string; name?: string; display_name: string }[]
  return places.map((place) => ({
    name: place.name || place.display_name.split(',')[0],
    description: place.display_name,
    point: { lat: parseFloat(place.lat), lng: parseFloat(place.lon) },
  }))
}

type Props = {
  /** Text to start from, e.g. the selection in the note. */
  initialText?: string
  /** An existing location to edit. */
  initialLocation?: LocationPayload
  confirmLabel: string
  onConfirm: (location: LocationPayload) => void
  onClose: () => void
}

/**
 * Chooses a place: typed or pasted coordinates, plus codes and map links are converted on the device; a
 * place name or a short plus code is looked up online only when Search is pressed; the map, also loaded
 * only on request, fine-tunes the point.
 */
export function LocationDialog({ initialText, initialLocation, confirmLabel, onConfirm, onClose }: Props) {
  const [text, setText] = useState(initialLocation ? formatCoordinates(initialLocation) : initialText ?? '')
  const [point, setPoint] = useState<GeoPoint | null>(
    initialLocation ? { lat: initialLocation.lat, lng: initialLocation.lng } : parseLocationText(initialText ?? ''),
  )
  const [name, setName] = useState(initialLocation?.name ?? '')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [isMapShown, setIsMapShown] = useState(false)

  const onTextChange = (value: string) => {
    setText(value)
    setResults(null)
    setSearchError(false)
    setPoint(parseLocationText(value))
  }

  const trimmedText = text.trim()
  const canSearch = trimmedText.length > 1 && !parseLocationText(trimmedText)

  const search = async () => {
    if (!canSearch || isSearching) {
      return
    }
    setIsSearching(true)
    setSearchError(false)
    setResults(null)
    try {
      const shortCode = parseShortPlusCode(trimmedText)
      const places = await searchPlaces(shortCode ? shortCode.locality : trimmedText)
      const recovered = shortCode && places.length > 0 ? recoverShortPlusCode(shortCode.code, places[0].point) : null
      if (recovered) {
        setPoint(recovered)
      } else {
        setResults(places)
      }
    } catch (error) {
      console.error(error)
      setSearchError(true)
    } finally {
      setIsSearching(false)
    }
  }

  const chooseResult = (result: SearchResult) => {
    setPoint(result.point)
    setResults(null)
    if (!name.trim()) {
      setName(result.name)
    }
  }

  const onMapMoved = useCallback((center: GeoPoint) => {
    setPoint(center)
    setText(formatCoordinates(center))
    setResults(null)
  }, [])

  const confirm = () => {
    if (!point) {
      return
    }
    onConfirm({ ...point, name: name.trim() || undefined })
    onClose()
  }

  const focusOnMount = useCallback((element: HTMLInputElement | null) => {
    if (element) {
      setTimeout(() => element.focus())
    }
  }, [])

  return (
    <div className="flex flex-col gap-3 md:w-[28rem] md:max-w-full">
      <label className="flex flex-col gap-1.5">
        {c('B4.Notes.EditingUI.Label').t`Coordinates, plus code, map link or place name:`}
        <DecoratedInput
          value={text}
          onChange={onTextChange}
          onEnter={point ? confirm : search}
          placeholder="47.3769, 8.5417"
          ref={focusOnMount}
        />
      </label>

      {canSearch && !point && (
        <div className="flex items-center gap-3">
          <Button onClick={search} disabled={isSearching} small={isMobileScreen()}>
            {isSearching ? c('B4.Notes.EditingUI.Action').t`Searching…` : c('B4.Notes.EditingUI.Action').t`Search`}
          </Button>
          <span className="text-sm text-passive-0 lg:text-xs">
            {c('B4.Notes.EditingUI.Info').t`Sends this text to OpenStreetMap's search.`}
          </span>
        </div>
      )}
      {searchError && (
        <div className="text-sm text-danger">{c('B4.Notes.EditingUI.Info')
          .t`The search didn't work. Try again later.`}</div>
      )}
      {results && results.length === 0 && (
        <div className="text-sm text-passive-0">{c('B4.Notes.EditingUI.Info').t`No place found.`}</div>
      )}
      {results && results.length > 0 && (
        <div className="flex max-h-48 flex-col overflow-y-auto rounded border border-border">
          {results.map((result) => (
            <button
              key={`${result.point.lat},${result.point.lng},${result.description}`}
              type="button"
              className="border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-contrast"
              onClick={() => chooseResult(result)}
            >
              {result.description}
            </button>
          ))}
        </div>
      )}

      {point && (
        <>
          <div className="select-text text-sm" data-testid="location-preview">
            <span className="font-semibold">{formatCoordinates(point)}</span>
            <span className="text-passive-0"> · {encodePlusCode(point)}</span>
          </div>
          {isMapShown ? (
            <>
              <LocationMap center={point} onCenterChange={onMapMoved} className="h-56" />
              <div className="text-sm text-passive-0 lg:text-xs">
                {c('B4.Notes.EditingUI.Info').t`Drag the map to move the pin.`}
              </div>
            </>
          ) : (
            <div>
              <Button onClick={() => setIsMapShown(true)} small>
                {c('B4.Notes.EditingUI.Action').t`Adjust on a map`}
              </Button>
            </div>
          )}
          <label className="flex flex-col gap-1.5">
            {c('B4.Notes.EditingUI.Label').t`Name (optional):`}
            <DecoratedInput value={name} onChange={setName} onEnter={confirm} />
          </label>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={confirm} disabled={!point} primary small={isMobileScreen()}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
