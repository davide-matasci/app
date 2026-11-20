import { $getRoot, EditorState } from 'lexical'
import { SuperName, jtString } from '@standardnotes/features'
import { c } from 'ttag'

export function truncateString(string: string, limit: number) {
  if (string.length <= limit) {
    return string
  } else {
    return string.substring(0, limit) + '...'
  }
}

export function handleEditorChange(
  editorState: EditorState,
  previewLength?: number,
  onChange?: (value: string, previewText: string) => void,
) {
  // The first two non-empty blocks (lines), not the first two text nodes: those end at the first formatting
  // change, so "Call **Bob** about the contract" previewed as "Call Bob"
  let previewText = $getRoot()
    .getChildren()
    .map((block) => block.getTextContent().trim())
    .filter((text) => text.length > 0)
    .slice(0, 2)
    .join('\n')

  if (previewLength) {
    previewText = truncateString(previewText, previewLength)
  }

  try {
    const stringifiedEditorState = JSON.stringify(editorState.toJSON())
    onChange?.(stringifiedEditorState, previewText)
  } catch (error) {
    console.error(error)
    const errorDetails = JSON.stringify(error)
    window.alert(
      jtString(
        c('B4.Notes.EditingUI.Info')
          .jt`An invalid change was made inside the ${SuperName} editor. Your change was not saved. Please report this error to the team: ${errorDetails}`,
      ),
    )
  }
}
