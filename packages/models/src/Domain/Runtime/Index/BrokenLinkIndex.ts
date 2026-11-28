import { ContentType } from '@standardnotes/domain-core'
import { ItemDelta } from './ItemDelta'

type LinkingItem = {
  uuid: string
  content_type: string
  noteType?: string
  editorIdentifier?: string
  text?: string
  trashed?: boolean
  archived?: boolean
}

/** The linked item of a Super note's bubble ("itemUuid") or embedded file ("fileUuid"), as stored in its text. */
const LINKED_UUID = /"(?:itemUuid|fileUuid)":"([0-9a-fA-F-]{36})"/g

/**
 * Which Super notes link, in their text, to a note, tag or file that no longer exists (shown there as a
 * deleted item), for the "Broken links" view. Notes in the trash or archived don't count.
 *
 * Whether a link is broken depends on other items existing, so a change to one item (deleted, or arriving
 * later during loading or sync) can change the answer for notes linking to it: onChange returns the uuids
 * of the notes whose status changed, for display lists to re-check.
 */
export class BrokenLinkIndex {
  /** Links of every counted note that has any. */
  private targetsByNote = new Map<string, string[]>()
  private notesByTarget = new Map<string, Set<string>>()
  private brokenNotes = new Set<string>()

  constructor(private exists: (uuid: string) => boolean) {}

  static linkedUuids(text: string | undefined): string[] {
    if (!text || (!text.includes('"itemUuid"') && !text.includes('"fileUuid"'))) {
      return []
    }
    const uuids = new Set<string>()
    for (const match of text.matchAll(LINKED_UUID)) {
      uuids.add(match[1])
    }
    return [...uuids]
  }

  hasBrokenLink(uuid: string): boolean {
    return this.brokenNotes.has(uuid)
  }

  brokenCount(): number {
    return this.brokenNotes.size
  }

  /** Updates the index and returns the notes whose broken status changed. */
  onChange(delta: Partial<ItemDelta>): string[] {
    const notesToCheck = new Set<string>()

    const setTargets = (noteUuid: string, targets: string[]) => {
      for (const target of this.targetsByNote.get(noteUuid) ?? []) {
        const notes = this.notesByTarget.get(target)
        notes?.delete(noteUuid)
        if (notes?.size === 0) {
          this.notesByTarget.delete(target)
        }
      }
      if (targets.length > 0) {
        this.targetsByNote.set(noteUuid, targets)
        for (const target of targets) {
          const notes = this.notesByTarget.get(target) ?? new Set<string>()
          notes.add(noteUuid)
          this.notesByTarget.set(target, notes)
        }
      } else {
        this.targetsByNote.delete(noteUuid)
      }
      notesToCheck.add(noteUuid)
    }

    const present = [...(delta.changed ?? []), ...(delta.inserted ?? []), ...(delta.unerrored ?? [])]
    const gone = [...(delta.discarded ?? []), ...(delta.ignored ?? [])]

    for (const item of present as unknown as LinkingItem[]) {
      if (item.content_type !== ContentType.TYPES.Note) {
        continue
      }
      const isSuperNote = item.noteType === 'super' || item.editorIdentifier === 'com.standardnotes.super'
      const counts = isSuperNote && !item.trashed && !item.archived
      const targets = counts ? BrokenLinkIndex.linkedUuids(item.text) : []
      if (targets.length > 0 || this.targetsByNote.has(item.uuid)) {
        setTargets(item.uuid, targets)
      }
    }
    for (const item of gone) {
      if (this.targetsByNote.has(item.uuid)) {
        setTargets(item.uuid, [])
      }
    }

    // Any of these items may have started or stopped existing: re-check the notes linking to them.
    for (const item of [...present, ...gone]) {
      this.notesByTarget.get(item.uuid)?.forEach((noteUuid) => notesToCheck.add(noteUuid))
    }

    const changedStatus: string[] = []
    for (const noteUuid of notesToCheck) {
      const isBroken = (this.targetsByNote.get(noteUuid) ?? []).some((target) => !this.exists(target))
      if (isBroken !== this.brokenNotes.has(noteUuid)) {
        if (isBroken) {
          this.brokenNotes.add(noteUuid)
        } else {
          this.brokenNotes.delete(noteUuid)
        }
        changedStatus.push(noteUuid)
      }
    }
    return changedStatus
  }
}
