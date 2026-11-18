import { c } from 'ttag'
import { DecryptedItemInterface, ItemContent, isNote, isTag } from '@standardnotes/snjs'
import { WebApplicationInterface } from '@standardnotes/ui-services'

export function getItemTitleInContextOfLinkBubble(item: DecryptedItemInterface<ItemContent>) {
  if (item.title && item.title.length > 0) {
    return item.title
  }
  if (!isNote(item)) {
    return ''
  }
  /** An untitled note falls back to its text: never for a protected note, which must not show unauthenticated. */
  return item.protected ? c('Label').t`Protected note` : item.preview_plain
}

function getItemSearchableString(item: DecryptedItemInterface<ItemContent>, application: WebApplicationInterface) {
  if (isNote(item)) {
    if (item.title.length > 0) {
      return item.title
    } else if (!item.protected) {
      return item.preview_plain
    }
  } else if (isTag(item)) {
    return application.items.getTagLongTitle(item)
  }

  return item.title ?? ''
}

export function doesItemMatchSearchQuery(
  item: DecryptedItemInterface<ItemContent>,
  searchQuery: string,
  application: WebApplicationInterface,
) {
  const title = getItemSearchableString(item, application).toLowerCase()
  const matchesQuery = title.includes(searchQuery.toLowerCase())
  const isArchivedOrTrashed = item.archived || item.trashed
  const isValidSearchResult = matchesQuery && !isArchivedOrTrashed

  return isValidSearchResult
}
