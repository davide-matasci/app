import { useApplication } from '@/Components/ApplicationProvider'
import Icon from '@/Components/Icon/Icon'
import Menu from '@/Components/Menu/Menu'
import MenuItem from '@/Components/Menu/MenuItem'
import Popover from '@/Components/Popover/Popover'
import { copyTextToClipboard } from '@/Utils/copyTextToClipboard'
import { BlockWithAlignableContents } from '@lexical/react/LexicalBlockWithAlignableContents'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey, ElementFormatType, NodeKey } from 'lexical'
import { MouseEvent, useRef, useState } from 'react'
import { c } from 'ttag'
import useModal from '../../Lexical/Hooks/useModal'
import { encodePlusCode, formatCoordinates, mapLinks } from './Location'
import { LocationDialog } from './LocationDialog'
import LocationMap from './LocationMap'
import { $isLocationNode, LocationPayload } from './LocationNode'

type Props = {
  lat: number
  lng: number
  name?: string
  className: Readonly<{
    base: string
    focus: string
  }>
  format: ElementFormatType | null
  nodeKey: NodeKey
}

const actionClass =
  'flex items-center gap-1 rounded border border-border bg-default px-2 py-1 text-sm hover:bg-contrast lg:text-xs'

const keepEditorFocus = (event: MouseEvent) => event.preventDefault()

const LocationComponent = ({ lat, lng, name, className, format, nodeKey }: Props) => {
  const application = useApplication()
  const [editor] = useLexicalComposerContext()
  const [isMapShown, setIsMapShown] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const [modal, showModal] = useModal()

  const point = { lat, lng }
  const coordinates = formatCoordinates(point)
  const plusCode = encodePlusCode(point)
  const links = mapLinks(point, name)

  const openLink = (url: string) => {
    setIsMenuOpen(false)
    application.device.openUrl(url)
  }

  const copy = (text: string) => {
    setIsMenuOpen(false)
    copyTextToClipboard(text)
  }

  const edit = () => {
    showModal(c('B3.Notes.EditorToolbar.Label').t`Edit location`, (onClose) => (
      <LocationDialog
        initialLocation={{ lat, lng, name }}
        confirmLabel={c('B4.Notes.EditingUI.Action').t`Save`}
        onClose={onClose}
        onConfirm={(location: LocationPayload) => {
          editor.update(() => {
            const node = $getNodeByKey(nodeKey)
            if ($isLocationNode(node)) {
              node.setLocation(location)
            }
          })
        }}
      />
    ))
  }

  return (
    <BlockWithAlignableContents className={className} format={format} nodeKey={nodeKey}>
      <div className="my-1 w-full max-w-xl rounded border border-border bg-default p-3" data-testid="location-block">
        <div className="flex items-start gap-2">
          <svg className="mt-0.5 flex-shrink-0" width="18" height="22" viewBox="0 0 28 36" aria-hidden>
            <path
              d="M14 1C7 1 1.5 6.4 1.5 13.2 1.5 22 14 35 14 35s12.5-13 12.5-21.8C26.5 6.4 21 1 14 1z"
              fill="#e5484d"
            />
            <circle cx="14" cy="13" r="4.5" fill="#ffffff" />
          </svg>
          <div className="min-w-0 flex-grow select-text">
            <div className="break-words font-semibold">{name || c('B4.Notes.EditingUI.Label').t`Location`}</div>
            <div className="text-sm text-passive-0">
              {coordinates} · {plusCode}
            </div>
          </div>
        </div>
        {/* Pressing a button must not move focus out of the note's text: the toolbar would collapse and
            shift the page under the pointer, and the click would miss. */}
        <div className="mt-2 flex flex-wrap gap-2" onMouseDown={keepEditorFocus}>
          <button type="button" className={actionClass} onClick={() => setIsMapShown(!isMapShown)}>
            {isMapShown ? c('B4.Notes.EditingUI.Action').t`Hide map` : c('B4.Notes.EditingUI.Action').t`Show map`}
          </button>
          <button type="button" className={actionClass} ref={menuButtonRef} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {c('B4.Notes.EditingUI.Action').t`Open in…`}
            <Icon type="chevron-down" size="small" />
          </button>
          {editor.isEditable() && (
            <button type="button" className={actionClass} onClick={edit}>
              {c('B4.Notes.EditingUI.Action').t`Edit`}
            </button>
          )}
        </div>
        {isMapShown && (
          <div className="mt-2" onMouseDown={keepEditorFocus}>
            <LocationMap center={point} marker={point} className="h-64" />
          </div>
        )}
        <Popover
          title={c('B4.Notes.EditingUI.Label').t`Open location in`}
          anchorElement={menuButtonRef}
          open={isMenuOpen}
          togglePopover={() => setIsMenuOpen(!isMenuOpen)}
          side="bottom"
          align="start"
          className="py-1"
        >
          <Menu a11yLabel={c('B4.Notes.EditingUI.Label').t`Open location in`}>
            <MenuItem onClick={() => openLink(links.apple)}>Apple Maps</MenuItem>
            <MenuItem onClick={() => openLink(links.google)}>Google Maps</MenuItem>
            <MenuItem onClick={() => openLink(links.openStreetMap)}>OpenStreetMap</MenuItem>
            <MenuItem onClick={() => copy(coordinates)}>{c('B4.Notes.EditingUI.Action').t`Copy coordinates`}</MenuItem>
            <MenuItem onClick={() => copy(plusCode)}>{c('B4.Notes.EditingUI.Action').t`Copy plus code`}</MenuItem>
          </Menu>
        </Popover>
        {modal}
      </div>
    </BlockWithAlignableContents>
  )
}

export default LocationComponent
