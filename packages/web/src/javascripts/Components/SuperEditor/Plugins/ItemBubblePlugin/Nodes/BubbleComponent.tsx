import { useCallback, useMemo } from 'react'
import { useApplication } from '@/Components/ApplicationProvider'
import LinkedItemBubble from '@/Components/LinkedItems/LinkedItemBubble'
import { createLinkFromItem } from '@/Utils/Items/Search/createLinkFromItem'
import { useLinkingController } from '@/Controllers/LinkingControllerProvider'
import { LinkableItem } from '@/Utils/Items/Search/LinkableItem'
import { useResponsiveAppPane } from '@/Components/Panes/ResponsivePaneProvider'
import { LexicalNode } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { c } from 'ttag'
import Icon from '@/Components/Icon/Icon'

export type BubbleComponentProps = Readonly<{
  itemUuid: string
  node: LexicalNode
}>

export function BubbleComponent({ itemUuid, node }: BubbleComponentProps) {
  const application = useApplication()
  const [editor] = useLexicalComposerContext()
  const linkingController = useLinkingController()
  const item = useMemo(() => application.items.findItem(itemUuid), [application, itemUuid])
  const { toggleAppPane } = useResponsiveAppPane()

  const activateItemAndTogglePane = useCallback(
    async (item: LinkableItem) => {
      const paneId = await linkingController.activateItem(item)
      if (paneId) {
        toggleAppPane(paneId)
      }
    },
    [toggleAppPane, linkingController],
  )

  const unlinkPressed = useCallback(async () => {
    editor.update(() => {
      node.remove()
    })
  }, [linkingController, node, editor])

  if (!item) {
    /** The item was deleted for good: an inline, removable placeholder, not a block with a raw uuid. */
    const label = c('B4.Notes.EditingUI.Info').t`Deleted item`
    return (
      <span
        className="mx-0.5 inline-flex h-6 items-center rounded bg-passive-4-opacity-variant py-2 pl-1 pr-2 align-middle text-sm text-passive-1 lg:text-xs"
        title={c('B4.Notes.EditingUI.Info').t`This item no longer exists`}
      >
        <Icon type="trash" className="mr-1 flex-shrink-0" size="small" />
        <span className="line-through">{label}</span>
        {editor.isEditable() && (
          <button
            className="-mr-1 ml-2 inline-flex cursor-pointer border-0 bg-transparent p-0"
            onClick={unlinkPressed}
            aria-label={c('B4.Notes.EditingUI.Action').t`Remove`}
          >
            <Icon type="close" className="text-neutral hover:text-info" size="small" />
          </button>
        )}
      </span>
    )
  }

  const link = createLinkFromItem(item, 'linked')

  return (
    <LinkedItemBubble
      className="mx-0.5"
      link={link}
      key={link.id}
      activateItem={activateItemAndTogglePane}
      unlinkItem={unlinkPressed}
      isBidirectional={false}
      inlineFlex={true}
      wrappable
    />
  )
}
