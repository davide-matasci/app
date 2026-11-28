import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react'
import { c } from 'ttag'
import { GeoPoint, MAP_MAX_ZOOM, MAP_MIN_ZOOM, MAP_TILE_SIZE, pointToWorldPixels, worldPixelsToPoint } from './Location'

type Props = {
  /** Where the map is centred when it appears, and again whenever this point changes. */
  center: GeoPoint
  /**
   * A pin at a fixed place, which moves with the map. Without it the pin stays in the middle and the map
   * moves under it: the middle is then reported through onCenterChange (for choosing a place).
   */
  marker?: GeoPoint
  onCenterChange?: (center: GeoPoint) => void
  initialZoom?: number
  className?: string
}

const TILE_URL = 'https://tile.openstreetmap.org'

/**
 * A small draggable, zoomable map made of OpenStreetMap image tiles. It is only rendered once the user asks
 * for a map: showing it requests the tiles of the visible area from OpenStreetMap's servers.
 */
const LocationMap = ({ center: givenCenter, marker, onCenterChange, initialZoom = 15, className = '' }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [center, setCenter] = useState(givenCenter)
  const [zoom, setZoom] = useState(initialZoom)
  const drag = useRef<{ pointerId: number; x: number; y: number; centerX: number; centerY: number } | null>(null)
  const latestCenter = useRef(center)
  latestCenter.current = center

  useEffect(() => {
    setCenter(givenCenter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [givenCenter.lat, givenCenter.lng])

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const centerPixels = pointToWorldPixels(center, zoom)
  const left = centerPixels.x - size.width / 2
  const top = centerPixels.y - size.height / 2

  const tiles: { key: string; src: string; x: number; y: number }[] = []
  if (size.width > 0 && size.height > 0) {
    const tilesPerSide = Math.pow(2, zoom)
    for (let tileX = Math.floor(left / MAP_TILE_SIZE); tileX * MAP_TILE_SIZE < left + size.width; tileX++) {
      for (let tileY = Math.floor(top / MAP_TILE_SIZE); tileY * MAP_TILE_SIZE < top + size.height; tileY++) {
        if (tileY < 0 || tileY >= tilesPerSide) {
          continue
        }
        const wrappedX = ((tileX % tilesPerSide) + tilesPerSide) % tilesPerSide
        tiles.push({
          key: `${zoom}/${tileX}/${tileY}`,
          src: `${TILE_URL}/${zoom}/${wrappedX}/${tileY}.png`,
          x: Math.round(tileX * MAP_TILE_SIZE - left),
          y: Math.round(tileY * MAP_TILE_SIZE - top),
        })
      }
    }
  }

  const markerPixels = marker ? pointToWorldPixels(marker, zoom) : centerPixels
  const markerLeft = marker ? markerPixels.x - left : size.width / 2
  const markerTop = marker ? markerPixels.y - top : size.height / 2

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, a')) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      centerX: centerPixels.x,
      centerY: centerPixels.y,
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start || start.pointerId !== event.pointerId) {
      return
    }
    setCenter(
      worldPixelsToPoint(
        { x: start.centerX - (event.clientX - start.x), y: start.centerY - (event.clientY - start.y) },
        zoom,
      ),
    )
  }

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) {
      return
    }
    drag.current = null
    onCenterChange?.(latestCenter.current)
  }

  const changeZoom = useCallback((change: number) => {
    setZoom((current) => Math.min(Math.max(current + change, MAP_MIN_ZOOM), MAP_MAX_ZOOM))
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }
    // Not a React onWheel: that listener is passive and can't stop the note from scrolling.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      changeZoom(event.deltaY < 0 ? 1 : -1)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [changeZoom])

  const zoomButtonClass =
    'flex h-8 w-8 items-center justify-center bg-default text-lg font-bold text-text hover:bg-contrast disabled:opacity-50'

  return (
    <div
      ref={containerRef}
      className={`relative cursor-grab touch-none select-none overflow-hidden rounded bg-contrast active:cursor-grabbing ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={() => changeZoom(1)}
      role="application"
      aria-label={c('B4.Notes.EditingUI.Label').t`Map`}
    >
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={tile.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{ left: tile.x, top: tile.y, width: MAP_TILE_SIZE, height: MAP_TILE_SIZE }}
        />
      ))}
      <svg
        className="pointer-events-none absolute"
        style={{ left: markerLeft - 14, top: markerTop - 36 }}
        width="28"
        height="36"
        viewBox="0 0 28 36"
        aria-hidden
      >
        <path
          d="M14 1C7 1 1.5 6.4 1.5 13.2 1.5 22 14 35 14 35s12.5-13 12.5-21.8C26.5 6.4 21 1 14 1z"
          fill="#e5484d"
          stroke="#ffffff"
          strokeWidth="2"
        />
        <circle cx="14" cy="13" r="4.5" fill="#ffffff" />
      </svg>
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded border border-border shadow-sm">
        <button
          type="button"
          className={zoomButtonClass}
          onClick={() => changeZoom(1)}
          disabled={zoom >= MAP_MAX_ZOOM}
          aria-label={c('B4.Notes.EditingUI.Action').t`Zoom in`}
        >
          +
        </button>
        <button
          type="button"
          className={`${zoomButtonClass} border-t border-border`}
          onClick={() => changeZoom(-1)}
          disabled={zoom <= MAP_MIN_ZOOM}
          aria-label={c('B4.Notes.EditingUI.Action').t`Zoom out`}
        >
          −
        </button>
      </div>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-0 right-0 rounded-tl bg-default px-1.5 py-0.5 text-[0.65rem] text-passive-0 opacity-80"
      >
        © OpenStreetMap
      </a>
    </div>
  )
}

export default LocationMap
