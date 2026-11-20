import { forwardRef, useCallback, useImperativeHandle } from 'react'
import { $convertToMarkdownString } from '@lexical/markdown'
import { MarkdownTransformers } from '../../MarkdownTransformers'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'

export type GetMarkdownPluginInterface = {
  getMarkdown: () => string
  /** The editor's current content as Super JSON, including typing not yet saved */
  getJson: () => string
}

const GetMarkdownPlugin = forwardRef<GetMarkdownPluginInterface>((_, ref) => {
  const [editor] = useLexicalComposerContext()

  useImperativeHandle(ref, () => ({
    getMarkdown() {
      return getMarkdown()
    },
    getJson() {
      return JSON.stringify(editor.getEditorState().toJSON())
    },
  }))

  const getMarkdown = useCallback(() => {
    return editor.getEditorState().read(() => {
      return $convertToMarkdownString(MarkdownTransformers)
    })
  }, [editor])

  return null
})

export default GetMarkdownPlugin
