import {
  ContentType,
  ItemManagerInterface,
  ItemWithTags,
  PredicateJsonForm,
  SNNote,
  isTag,
  predicateFromJson,
} from '@standardnotes/snjs'

/**
 * How many notes (outside the trash) a smart view's predicate matches, evaluated the way
 * the app evaluates views: with each note's tags attached when a condition uses tags.
 * Returns undefined if the predicate can't be evaluated.
 */
export function countMatchingNotes(items: ItemManagerInterface, predicateJson: PredicateJsonForm): number | undefined {
  try {
    const predicate = predicateFromJson<SNNote>(predicateJson)
    const usesTags = predicate.keypathIncludesString('tags')
    const notes = items.getItems<SNNote>(ContentType.TYPES.Note).filter((note) => !note.trashed)

    return notes.filter((note) => {
      const target = usesTags
        ? (ItemWithTags.Create(note.payload, note, items.itemsReferencingItem(note).filter(isTag)) as unknown as SNNote)
        : note
      return predicate.matchesItem(target)
    }).length
  } catch {
    return undefined
  }
}
