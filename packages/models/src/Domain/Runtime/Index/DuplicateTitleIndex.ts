import { ContentType } from '@standardnotes/domain-core'
import { ItemDelta } from './ItemDelta'

type TitledItem = {
  uuid: string
  content_type: string
  title?: string
  trashed?: boolean
  archived?: boolean
}

/**
 * Which notes share their title with another note, for the "Duplicate titles" view. Titles are compared
 * without regard to case and surrounding spaces; notes without a title, in the trash or archived don't count.
 *
 * Whether a note is a duplicate depends on other notes, so a change to one note can change the answer for
 * others: onChange returns the uuids of those others, for display lists to re-check.
 */
export class DuplicateTitleIndex {
  private uuidsByTitle = new Map<string, Set<string>>()
  private titleByUuid = new Map<string, string>()

  static normalizedTitle(title: string | undefined): string {
    return (title ?? '').trim().toLowerCase()
  }

  hasDuplicateTitle(uuid: string): boolean {
    const title = this.titleByUuid.get(uuid)
    return title !== undefined && (this.uuidsByTitle.get(title)?.size ?? 0) > 1
  }

  /** The number of notes whose title is shared with at least one other note. */
  duplicateCount(): number {
    let count = 0
    for (const uuids of this.uuidsByTitle.values()) {
      if (uuids.size > 1) {
        count += uuids.size
      }
    }
    return count
  }

  /** Updates the index and returns the other notes whose duplicate status changed as a result. */
  onChange(delta: Partial<ItemDelta>): string[] {
    const changedUuids = new Set<string>()
    const affectedOthers = new Set<string>()

    const set = (uuid: string, title: string | undefined) => {
      const previous = this.titleByUuid.get(uuid)
      if (previous === title) {
        return
      }
      changedUuids.add(uuid)
      if (previous !== undefined) {
        const group = this.uuidsByTitle.get(previous) as Set<string>
        group.delete(uuid)
        this.titleByUuid.delete(uuid)
        // Two notes shared the title: the one left is no longer a duplicate.
        if (group.size === 1) {
          group.forEach((other) => affectedOthers.add(other))
        }
        if (group.size === 0) {
          this.uuidsByTitle.delete(previous)
        }
      }
      if (title !== undefined) {
        const group = this.uuidsByTitle.get(title) ?? new Set<string>()
        // A note alone with this title becomes a duplicate.
        if (group.size === 1) {
          group.forEach((other) => affectedOthers.add(other))
        }
        group.add(uuid)
        this.uuidsByTitle.set(title, group)
        this.titleByUuid.set(uuid, title)
      }
    }

    const present = [...(delta.changed ?? []), ...(delta.inserted ?? []), ...(delta.unerrored ?? [])]
    for (const item of present as unknown as TitledItem[]) {
      if (item.content_type !== ContentType.TYPES.Note) {
        continue
      }
      const title = DuplicateTitleIndex.normalizedTitle(item.title)
      const counts = title.length > 0 && !item.trashed && !item.archived
      set(item.uuid, counts ? title : undefined)
    }
    for (const item of [...(delta.discarded ?? []), ...(delta.ignored ?? [])]) {
      set(item.uuid, undefined)
    }

    return [...affectedOthers].filter((uuid) => !changedUuids.has(uuid))
  }
}
