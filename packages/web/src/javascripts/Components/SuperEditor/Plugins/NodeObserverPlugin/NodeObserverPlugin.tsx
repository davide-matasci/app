import { useEffect, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey, Klass, LexicalNode } from 'lexical'
import { $dfs } from '@lexical/utils'
import { ItemNodeInterface } from '../ItemNodeInterface'

type NodeKey = string
type ItemUuid = string

type ObserverProps = {
  nodeType: Klass<LexicalNode>
  onRemove: (itemUuid: string) => void
}

export function NodeObserverPlugin({ nodeType, onRemove }: ObserverProps) {
  const [editor] = useLexicalComposerContext()
  const map = useRef<Map<NodeKey, ItemUuid>>(new Map())

  useEffect(() => {
    const removeMutationListener = editor.registerMutationListener(nodeType, (mutatedNodes) => {
      editor.getEditorState().read(() => {
        for (const [nodeKey, mutation] of mutatedNodes) {
          if (mutation === 'updated' || mutation === 'created') {
            const node = $getNodeByKey(nodeKey) as unknown as ItemNodeInterface

            if (node) {
              const uuid = node.getId()
              map.current.set(nodeKey, uuid)
            }
          } else if (mutation === 'destroyed') {
            const uuid = map.current.get(nodeKey)
            map.current.delete(nodeKey)
            /** Another node can still point at the same item (a note mentioned twice). */
            if (uuid && !$isItemStillPresent(nodeType, uuid)) {
              onRemove(uuid)
            }
          }
        }
      })
    })

    return () => {
      removeMutationListener()
    }
  })

  return null
}

function $isItemStillPresent(nodeType: Klass<LexicalNode>, uuid: ItemUuid): boolean {
  return $dfs().some(({ node }) => node instanceof nodeType && (node as unknown as ItemNodeInterface).getId() === uuid)
}
