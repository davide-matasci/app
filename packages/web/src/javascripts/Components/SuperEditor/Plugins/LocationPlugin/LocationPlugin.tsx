import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $wrapNodeInElement, mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_NORMAL,
  LexicalEditor,
} from 'lexical'
import { useEffect } from 'react'
import { c } from 'ttag'
import { INSERT_LOCATION_COMMAND } from '../Commands'
import { parseLocationText, parseShortPlusCode } from './Location'
import { LocationDialog } from './LocationDialog'
import { $createLocationNode, LocationNode, LocationPayload } from './LocationNode'

/** The selected text, when it is short enough to be a place: it then starts the dialog and gets replaced. */
function getSelectedPlaceText(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      return ''
    }
    const text = selection.getTextContent().trim()
    return text.length <= 200 && !text.includes('\n') ? text : ''
  })
}

export function InsertLocationDialog({ editor, onClose }: { editor: LexicalEditor; onClose: () => void }) {
  const selectedText = getSelectedPlaceText(editor)
  // Selected coordinates or plus codes are converted (replaced); other selected text only starts the search.
  const replacesSelection = Boolean(parseLocationText(selectedText) || parseShortPlusCode(selectedText))

  return (
    <LocationDialog
      initialText={selectedText}
      confirmLabel={c('B4.Notes.EditingUI.Action').t`Insert`}
      onClose={onClose}
      onConfirm={(location) => {
        editor.dispatchCommand(INSERT_LOCATION_COMMAND, { ...location, replaceSelection: replacesSelection })
      }}
    />
  )
}

export default function LocationPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand<LocationPayload & { replaceSelection?: boolean }>(
        INSERT_LOCATION_COMMAND,
        (payload) => {
          const selection = $getSelection()
          if (payload.replaceSelection && $isRangeSelection(selection) && !selection.isCollapsed()) {
            selection.removeText()
          }
          const locationNode = $createLocationNode(payload)
          $insertNodes([locationNode])
          if ($isRootOrShadowRoot(locationNode.getParentOrThrow())) {
            $wrapNodeInElement(locationNode, $createParagraphNode).selectEnd()
          }
          const newLineNode = $createParagraphNode()
          locationNode.getParentOrThrow().insertAfter(newLineNode)

          return true
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerNodeTransform(LocationNode, (node) => {
        // Like images: inserted inside a paragraph, then moved out of it when it is the only content.
        const parent = node.getParent()
        if (parent && $isParagraphNode(parent) && parent.getChildrenSize() === 1) {
          parent.insertBefore(node)
          parent.remove()
        }
      }),
    )
  }, [editor])

  return null
}
